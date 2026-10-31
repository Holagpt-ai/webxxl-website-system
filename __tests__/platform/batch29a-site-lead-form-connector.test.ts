import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  hashSiteLeadIntakeSecret,
  signSiteLeadIntakeRequest,
  verifySiteLeadIntakeSignature,
} from '@/lib/platform/site-leads/signature-auth'
import {
  buildSiteLeadIntakeIdempotencyKey,
  newSiteLeadSubmissionIdempotencyKey,
  redactSiteLeadConnectorConfig,
  resolveSiteLeadConnectorConfigFromEnv,
  serializeSiteLeadIntakeBody,
  submitManagedSiteLead,
} from '@/lib/platform/site-leads/connector'

const secret = 'connector-test-secret'
const publicKeyId = 'site_key_demo'

function mockFetch(status: number, body: unknown) {
  return vi.fn(async () =>
    Response.json(body, { status, headers: { 'content-type': 'application/json' } }),
  )
}

describe('Batch 29A managed-site form connector', () => {
  beforeEach(() => {
    vi.stubEnv('SITE_LEAD_INTAKE_ENABLED', 'true')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('produces HMAC signatures compatible with intake verification', () => {
    const rawBody = serializeSiteLeadIntakeBody({
      contactEmail: 'lead@example.com',
      message: 'Hello',
    })
    const signed = signSiteLeadIntakeRequest({ rawBody, secret, timestampSeconds: 1_700_000_000 })
    const verified = verifySiteLeadIntakeSignature({
      rawBody,
      signatureHeader: signed.signatureHeader,
      timestampHeader: signed.timestampHeader,
      secret,
      nowMs: 1_700_000_000 * 1000,
    })
    expect(verified.ok).toBe(true)
  })

  it('isolates credentials per public key id via env secret naming', () => {
    process.env.WEBXXL_SITE_LEAD_INTAKE_BASE_URL = 'https://crm.example.com'
    process.env.WEBXXL_SITE_LEAD_INTAKE_PUBLIC_KEY_ID = publicKeyId
    process.env.SITE_LEAD_INTAKE_SECRET_site_key_demo = secret
    const a = resolveSiteLeadConnectorConfigFromEnv()
    expect(a.publicKeyId).toBe(publicKeyId)
    process.env.WEBXXL_SITE_LEAD_INTAKE_PUBLIC_KEY_ID = 'other_site'
    process.env.SITE_LEAD_INTAKE_SECRET_other_site = 'other-secret'
    const b = resolveSiteLeadConnectorConfigFromEnv()
    expect(b.signingSecret).toBe('other-secret')
    expect(a.signingSecret).not.toBe(b.signingSecret)
    void hashSiteLeadIntakeSecret(secret)
  })

  it('fails configuration when signing secret is missing', async () => {
    const fetchImpl = mockFetch(201, { ok: true, leadId: 'x', status: 'RECEIVED', duplicate: false })
    const result = await submitManagedSiteLead({
      config: { intakeBaseUrl: 'https://app.test', publicKeyId, signingSecret: '' },
      payload: { contactEmail: 'a@b.com' },
      fetchImpl,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('CONFIG')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('reuses scoped intake keys when the same submission id is supplied', async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      Response.json({ ok: true, leadId: 'lead_1', status: 'RECEIVED', duplicate: false }, { status: 201 }),
    )
    const payload = { contactEmail: 'retry@example.com', message: 'Same' }
    const config = { intakeBaseUrl: 'https://app.test', publicKeyId, signingSecret: secret }
    const submissionId = 'stable-retry-key'
    const scoped = buildSiteLeadIntakeIdempotencyKey({ publicKeyId, submissionId })
    await submitManagedSiteLead({ config, payload, submissionId, fetchImpl, nowMs: 1_700_000_000_000 })
    await submitManagedSiteLead({ config, payload, submissionId, fetchImpl, nowMs: 1_700_000_000_000 })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    const init0 = fetchImpl.mock.calls[0]?.[1] as RequestInit | undefined
    const init1 = fetchImpl.mock.calls[1]?.[1] as RequestInit | undefined
    const key1 = init0?.headers as Record<string, string> | undefined
    const key2 = init1?.headers as Record<string, string> | undefined
    expect(key1?.['x-idempotency-key']).toBe(scoped)
    expect(key2?.['x-idempotency-key']).toBe(scoped)
  })

  it('scopes explicit submission ids to the site public key id', () => {
    const submissionId = 'fixed-key'
    const scoped = buildSiteLeadIntakeIdempotencyKey({ publicKeyId, submissionId })
    expect(scoped).toMatch(/^[a-f0-9]{64}$/)
    expect(scoped).not.toBe(submissionId)
  })

  it('retries rate limits and maps unauthorized responses without claiming success', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ code: 'RATE_LIMIT', message: 'Slow down' }, { status: 429 }))
      .mockResolvedValueOnce(
        Response.json({ ok: true, leadId: 'lead_ok', status: 'RECEIVED', duplicate: false }, { status: 201 }),
      )
    const ok = await submitManagedSiteLead({
      config: { intakeBaseUrl: 'https://app.test', publicKeyId, signingSecret: secret, maxRetries: 1 },
      payload: { contactEmail: 'rate@example.com' },
      fetchImpl,
      nowMs: 1_700_000_000_000,
    })
    expect(ok.ok).toBe(true)
    expect(fetchImpl).toHaveBeenCalledTimes(2)

    const denied = mockFetch(401, { code: 'UNAUTHORIZED', message: 'Invalid lead intake key' })
    const fail = await submitManagedSiteLead({
      config: { intakeBaseUrl: 'https://app.test', publicKeyId, signingSecret: secret },
      payload: { contactEmail: 'deny@example.com' },
      fetchImpl: denied,
    })
    expect(fail.ok).toBe(false)
    if (!fail.ok) expect(fail.code).toBe('UNAUTHORIZED')
  })

  it('never exposes signing secrets in redacted config snapshots', () => {
    const redacted = redactSiteLeadConnectorConfig({
      intakeBaseUrl: 'https://app.test',
      publicKeyId,
      signingSecret: secret,
    })
    expect(JSON.stringify(redacted)).not.toContain(secret)
    expect(redacted.publicKeyId).toBe(publicKeyId)
  })

  it('rejects client-supplied tenant or consent fields in serialized payloads', () => {
    expect(() =>
      serializeSiteLeadIntakeBody(
        Object.assign({ contactEmail: 'a@b.com' }, { customerAccountId: 'x' }) as never,
      ),
    ).toThrow(/must not be sent/)
    expect(() =>
      serializeSiteLeadIntakeBody(
        Object.assign({ contactEmail: 'a@b.com' }, { marketingConsent: true }) as never,
      ),
    ).toThrow(/must not be sent/)
  })

  it('does not import messaging or consent grant modules', async () => {
    const connector = await import('@/lib/platform/site-leads/connector/submit')
    expect(Object.keys(connector)).not.toContain('sendEmail')
    expect(newSiteLeadSubmissionIdempotencyKey()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
  })

  it('completes synthetic intake submission when API confirms success', async () => {
    const rawBody = serializeSiteLeadIntakeBody({ contactEmail: 'ok@example.com' })
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      const headers = init?.headers as Record<string, string>
      const sig = createHmac('sha256', secret)
        .update(`${headers['x-webxxl-timestamp']}.${rawBody}`)
        .digest('hex')
      expect(headers['x-webxxl-signature']).toBe(sig)
      expect(headers['x-webxxl-lead-intake-key']).toBe(publicKeyId)
      return Response.json({ ok: true, leadId: 'lead_syn', status: 'RECEIVED', duplicate: false }, { status: 201 })
    })
    const result = await submitManagedSiteLead({
      config: { intakeBaseUrl: 'https://app.test', publicKeyId, signingSecret: secret },
      payload: { contactEmail: 'ok@example.com' },
      fetchImpl,
      nowMs: 1_700_000_000_000,
    })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.leadId).toBe('lead_syn')
  })

  it('returns DISABLED when intake flag is off on the server', async () => {
    const fetchImpl = mockFetch(503, {
      code: 'SITE_LEAD_INTAKE_DISABLED',
      message: 'Managed-site lead intake is disabled',
    })
    const result = await submitManagedSiteLead({
      config: { intakeBaseUrl: 'https://app.test', publicKeyId, signingSecret: secret },
      payload: { contactEmail: 'off@example.com' },
      fetchImpl,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('DISABLED')
  })
})

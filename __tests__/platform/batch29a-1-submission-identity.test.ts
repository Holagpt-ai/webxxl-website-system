import { createHash } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildSiteLeadIntakeIdempotencyKey,
  newSiteLeadSubmissionId,
  resolveSiteLeadSubmissionId,
  serializeSiteLeadIntakeBody,
  SITE_LEAD_SUBMISSION_ID_MAX_LENGTH,
  SiteLeadSubmissionIdError,
  submitManagedSiteLead,
  validateExplicitSiteLeadSubmissionId,
} from '@/lib/platform/site-leads/connector'
import * as siteLeadConnector from '@/lib/platform/site-leads/connector'
import { POST } from '@/lib/platform/site-leads/connector/reference/nextjs-server-handler.example'

const secret = 'connector-test-secret'
const publicKeyId = 'site_key_demo'
const otherPublicKeyId = 'site_key_other'

describe('Batch 29A.1 submission identity & retry integrity', () => {
  beforeEach(() => {
    vi.stubEnv('SITE_LEAD_INTAKE_ENABLED', 'true')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('assigns distinct intake keys for identical content when no explicit submission id', async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      Response.json({ ok: true, leadId: 'lead_1', status: 'RECEIVED', duplicate: false }, { status: 201 }),
    )
    const payload = { contactEmail: 'same@example.com', message: 'Hello' }
    const config = { intakeBaseUrl: 'https://app.test', publicKeyId, signingSecret: secret }
    await submitManagedSiteLead({ config, payload, fetchImpl, nowMs: 1_700_000_000_000 })
    await submitManagedSiteLead({ config, payload, fetchImpl, nowMs: 1_700_000_000_000 })
    const keyA = (fetchImpl.mock.calls[0]?.[1] as RequestInit)?.headers as Record<string, string>
    const keyB = (fetchImpl.mock.calls[1]?.[1] as RequestInit)?.headers as Record<string, string>
    expect(keyA['x-idempotency-key']).not.toBe(keyB['x-idempotency-key'])
  })

  it('reuses the scoped intake key for stable submission id across requests and internal retries', async () => {
    const submissionId = 'client-retry-001'
    const scoped = buildSiteLeadIntakeIdempotencyKey({ publicKeyId, submissionId })
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ code: 'RATE_LIMIT', message: 'Slow down' }, { status: 429 }))
      .mockResolvedValueOnce(
        Response.json({ ok: true, leadId: 'lead_ok', status: 'RECEIVED', duplicate: false }, { status: 201 }),
      )
    const config = {
      intakeBaseUrl: 'https://app.test',
      publicKeyId,
      signingSecret: secret,
      maxRetries: 1,
    }
    const payload = { contactEmail: 'retry@example.com' }
    await submitManagedSiteLead({ config, payload, submissionId, fetchImpl, nowMs: 1_700_000_000_000 })
    const retryFetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      Response.json({ ok: true, leadId: 'lead_ok', status: 'RECEIVED', duplicate: true }, { status: 200 }),
    )
    await submitManagedSiteLead({ config, payload, submissionId, fetchImpl: retryFetch, nowMs: 1_700_000_001_000 })
    expect(scoped).toMatch(/^[a-f0-9]{64}$/)
    for (const call of fetchImpl.mock.calls) {
      const headers = (call[1] as RequestInit)?.headers as Record<string, string>
      expect(headers['x-idempotency-key']).toBe(scoped)
    }
    const retryHeaders = (retryFetch.mock.calls[0]?.[1] as RequestInit)?.headers as Record<string, string>
    expect(retryHeaders['x-idempotency-key']).toBe(scoped)
  })

  it('isolates scoped intake keys per publicKeyId for the same submission id', () => {
    const submissionId = 'shared-submission'
    const a = buildSiteLeadIntakeIdempotencyKey({ publicKeyId, submissionId })
    const b = buildSiteLeadIntakeIdempotencyKey({ publicKeyId: otherPublicKeyId, submissionId })
    expect(a).not.toBe(b)
    expect(a).toBe(
      createHash('sha256').update(`${publicKeyId}\n${submissionId}`, 'utf8').digest('hex'),
    )
  })

  it('rejects invalid and oversized explicit submission ids without truncation', async () => {
    expect(() => validateExplicitSiteLeadSubmissionId('')).toThrow(/empty/)
    expect(() => validateExplicitSiteLeadSubmissionId('bad id')).toThrow(/may only contain/)
    const tooLong = 'a'.repeat(SITE_LEAD_SUBMISSION_ID_MAX_LENGTH + 1)
    expect(() => validateExplicitSiteLeadSubmissionId(tooLong)).toThrow(/at most/)

    const fetchImpl = vi.fn()
    const fail = await submitManagedSiteLead({
      config: { intakeBaseUrl: 'https://app.test', publicKeyId, signingSecret: secret },
      payload: { contactEmail: 'a@b.com' },
      submissionId: tooLong,
      fetchImpl,
    })
    expect(fail.ok).toBe(false)
    if (!fail.ok) expect(fail.code).toBe('VALIDATION')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('maps same submission id with different payload to intake conflict semantics via stable scoped key', async () => {
    const submissionId = 'fixed-submission'
    const scoped = buildSiteLeadIntakeIdempotencyKey({ publicKeyId, submissionId })
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      Response.json(
        { code: 'CONFLICT', message: 'Idempotency key reused with different submission content' },
        { status: 409 },
      ),
    )
    const result = await submitManagedSiteLead({
      config: { intakeBaseUrl: 'https://app.test', publicKeyId, signingSecret: secret },
      payload: { contactEmail: 'conflict@example.com', message: 'B' },
      submissionId,
      fetchImpl,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('CONFLICT')
    const headers = (fetchImpl.mock.calls[0]?.[1] as RequestInit)?.headers as Record<string, string>
    expect(headers['x-idempotency-key']).toBe(scoped)
  })

  it('generates one submission id per submit call when omitted', () => {
    const a = resolveSiteLeadSubmissionId({})
    const b = resolveSiteLeadSubmissionId({})
    expect(a).not.toBe(b)
    expect(newSiteLeadSubmissionId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
  })

  it('rejects explicitly supplied empty or whitespace submission ids', () => {
    for (const empty of ['', '   ', '\t']) {
      expect(() => resolveSiteLeadSubmissionId({ submissionId: empty })).toThrow(SiteLeadSubmissionIdError)
      expect(() => resolveSiteLeadSubmissionId({ legacyIdempotencyKey: empty })).toThrow(SiteLeadSubmissionIdError)
    }
    expect(() => resolveSiteLeadSubmissionId({ submissionId: undefined })).not.toThrow()
    expect(() => resolveSiteLeadSubmissionId({ submissionId: null })).not.toThrow()
  })

  it('returns VALIDATION for empty submissionId on submit without calling intake', async () => {
    const fetchImpl = vi.fn()
    const result = await submitManagedSiteLead({
      config: { intakeBaseUrl: 'https://app.test', publicKeyId, signingSecret: secret },
      payload: { contactEmail: 'a@b.com' },
      submissionId: '   ',
      fetchImpl,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('VALIDATION')
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

describe('Batch 29A.1 reference Next.js handler', () => {
  beforeEach(() => {
    vi.stubEnv('WEBXXL_SITE_LEAD_INTAKE_BASE_URL', 'https://app.test')
    vi.stubEnv('WEBXXL_SITE_LEAD_INTAKE_PUBLIC_KEY_ID', publicKeyId)
    vi.stubEnv('SITE_LEAD_INTAKE_SECRET_site_key_demo', secret)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('requires a browser submission id on the first request', async () => {
    const submitSpy = vi.spyOn(siteLeadConnector, 'submitManagedSiteLead')
    const res = await POST(
      new Request('https://site.test/api/leads', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ contactEmail: 'a@b.com', submittedAt: '2026-01-01T00:00:00.000Z' }),
      }),
    )
    expect(res.status).toBe(400)
    const body = (await res.json()) as { code?: string }
    expect(body.code).toBe('VALIDATION')
    expect(submitSpy).not.toHaveBeenCalled()
  })

  it('rejects whitespace submission id headers', async () => {
    const submitSpy = vi.spyOn(siteLeadConnector, 'submitManagedSiteLead')
    const res = await POST(
      new Request('https://site.test/api/leads', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-webxxl-submission-id': '   ',
        },
        body: JSON.stringify({ contactEmail: 'a@b.com' }),
      }),
    )
    expect(res.status).toBe(400)
    expect(submitSpy).not.toHaveBeenCalled()
  })

  it('forwards identical payload bytes on first submit and retry with the same submission id', async () => {
    const submissionId = 'browser-uuid-0001'
    const form = {
      contactEmail: 'retry@example.com',
      message: 'Hi',
      submittedAt: '2026-06-15T12:00:00.000Z',
    }
    const expectedRaw = serializeSiteLeadIntakeBody(form)

    const submitSpy = vi.spyOn(siteLeadConnector, 'submitManagedSiteLead').mockResolvedValue({
      ok: true,
      leadId: 'lead_ref',
      status: 'RECEIVED',
      duplicate: false,
      httpStatus: 201,
    })

    const makeRequest = () =>
      new Request('https://site.test/api/leads', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-webxxl-submission-id': submissionId,
        },
        body: JSON.stringify(form),
      })

    await POST(makeRequest())
    await POST(makeRequest())

    expect(submitSpy).toHaveBeenCalledTimes(2)
    const firstPayload = submitSpy.mock.calls[0]?.[0]?.payload
    const secondPayload = submitSpy.mock.calls[1]?.[0]?.payload
    expect(serializeSiteLeadIntakeBody(firstPayload!)).toBe(expectedRaw)
    expect(serializeSiteLeadIntakeBody(secondPayload!)).toBe(expectedRaw)
    expect(firstPayload).toEqual(secondPayload)
    expect(submitSpy.mock.calls[0]?.[0]?.submissionId).toBe(submissionId)
    expect(submitSpy.mock.calls[1]?.[0]?.submissionId).toBe(submissionId)
  })
})

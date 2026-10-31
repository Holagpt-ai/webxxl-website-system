import { createHmac } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { hashSiteLeadIntakeSecret } from '@/lib/platform/site-leads/signature-auth'
import { buildSiteLeadIntakePayloadFingerprint } from '@/lib/platform/site-leads/payload-fingerprint'
const credential = {
  id: 'cred_1',
  publicKeyId: 'site_key_1',
  secretRef: null,
  secretHash: '',
  enabled: true,
  revokedAt: null,
  customerAccountId: 'acct_a',
  managedSiteId: 'site_a',
  createdAt: new Date(),
  updatedAt: new Date(),
}

vi.mock('@/lib/db', () => ({
  prisma: {
    managedSiteLead: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    managedSiteLeadIntakeCredential: { findUnique: vi.fn() },
    managedSite: { findFirst: vi.fn() },
    $queryRaw: vi.fn(),
  },
}))

vi.mock('@/lib/platform/site-leads/rate-limit', () => ({
  checkSiteLeadIntakeRateLimit: vi.fn(async () => ({ ok: true as const })),
}))

import { prisma } from '@/lib/db'
import { ingestManagedSiteLead } from '@/lib/platform/site-leads/ingest-service'

function signedBody(body: object, secret = 'test-secret') {
  const rawBody = JSON.stringify(body)
  const ts = Math.floor(Date.now() / 1000)
  const sig = createHmac('sha256', secret).update(`${ts}.${rawBody}`).digest('hex')
  return { rawBody, ts, sig, parsed: body }
}

describe('Batch 28A.2 intake payload idempotency', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('SITE_LEAD_INTAKE_ENABLED', 'true')
    process.env.SITE_LEAD_INTAKE_SECRET_site_key_1 = 'test-secret'
    credential.secretHash = hashSiteLeadIntakeSecret('test-secret')
    vi.mocked(prisma.managedSiteLeadIntakeCredential.findUnique).mockResolvedValue(credential)
    vi.mocked(prisma.managedSite.findFirst).mockResolvedValue({ id: 'site_a', domain: 'example.com' } as never)
  })

  it('does not treat legacy rows with empty payload fingerprint as verified replays', async () => {
    const body = { contactEmail: 'lead@example.com' }
    const { rawBody, ts, sig, parsed } = signedBody(body)
    vi.mocked(prisma.managedSiteLead.findUnique).mockResolvedValue({
      id: 'lead_legacy',
      status: 'RECEIVED',
      customerAccountId: 'acct_a',
      managedSiteId: 'site_a',
      intakePayloadFingerprint: '',
    } as never)

    const result = await ingestManagedSiteLead({
      publicKeyId: 'site_key_1',
      idempotencyKeyHeader: 'idem-legacy',
      signatureHeader: sig,
      timestampHeader: String(ts),
      rawBody,
      parsed,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('CONFLICT')
      expect(result.message).toContain('payload fingerprint')
    }
  })

  it('returns the existing lead when idempotency key and raw payload match', async () => {
    const body = { contactEmail: 'lead@example.com', message: 'Hello' }
    const { rawBody, ts, sig, parsed } = signedBody(body)
    const payloadFp = buildSiteLeadIntakePayloadFingerprint(rawBody)
    vi.mocked(prisma.managedSiteLead.findUnique).mockResolvedValue({
      id: 'lead_same',
      status: 'RECEIVED',
      customerAccountId: 'acct_a',
      managedSiteId: 'site_a',
      intakePayloadFingerprint: payloadFp,
    } as never)

    const result = await ingestManagedSiteLead({
      publicKeyId: 'site_key_1',
      idempotencyKeyHeader: 'idem-stable',
      signatureHeader: sig,
      timestampHeader: String(ts),
      rawBody,
      parsed,
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.leadId).toBe('lead_same')
      expect(result.duplicate).toBe(true)
    }
    expect(prisma.managedSiteLead.create).not.toHaveBeenCalled()
  })

  it('conflicts when idempotency key is reused with a changed raw body', async () => {
    const original = signedBody({ contactEmail: 'lead@example.com', message: 'Hello' })
    const changed = signedBody({ contactEmail: 'lead@example.com', message: 'Changed message' })
    const storedPayloadFp = buildSiteLeadIntakePayloadFingerprint(original.rawBody)

    vi.mocked(prisma.managedSiteLead.findUnique).mockResolvedValue({
      id: 'lead_existing',
      status: 'RECEIVED',
      customerAccountId: 'acct_a',
      managedSiteId: 'site_a',
      intakePayloadFingerprint: storedPayloadFp,
    } as never)

    const result = await ingestManagedSiteLead({
      publicKeyId: 'site_key_1',
      idempotencyKeyHeader: 'idem-stable',
      signatureHeader: changed.sig,
      timestampHeader: String(changed.ts),
      rawBody: changed.rawBody,
      parsed: changed.parsed,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('CONFLICT')
      expect(result.status).toBe(409)
    }
  })

  it('applies payload fingerprint comparison on P2002 concurrent insert recovery', async () => {
    const body = { contactEmail: 'lead@example.com' }
    const { rawBody, ts, sig, parsed } = signedBody(body)
    const payloadFp = buildSiteLeadIntakePayloadFingerprint(rawBody)

    vi.mocked(prisma.managedSiteLead.findUnique)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'lead_winner',
        status: 'RECEIVED',
        customerAccountId: 'acct_a',
        managedSiteId: 'site_a',
        intakePayloadFingerprint: payloadFp,
      } as never)
    vi.mocked(prisma.managedSiteLead.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.managedSiteLead.create).mockRejectedValue({ code: 'P2002' })

    const ok = await ingestManagedSiteLead({
      publicKeyId: 'site_key_1',
      idempotencyKeyHeader: 'idem-race',
      signatureHeader: sig,
      timestampHeader: String(ts),
      rawBody,
      parsed,
    })
    expect(ok.ok).toBe(true)
    if (ok.ok) expect(ok.leadId).toBe('lead_winner')

    const mismatch = signedBody({ contactEmail: 'lead@example.com', message: 'different' })
    vi.mocked(prisma.managedSiteLead.findUnique)
      .mockReset()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'lead_winner',
        status: 'RECEIVED',
        customerAccountId: 'acct_a',
        managedSiteId: 'site_a',
        intakePayloadFingerprint: payloadFp,
      } as never)
    vi.mocked(prisma.managedSiteLead.create).mockRejectedValue({ code: 'P2002' })

    const conflict = await ingestManagedSiteLead({
      publicKeyId: 'site_key_1',
      idempotencyKeyHeader: 'idem-race',
      signatureHeader: mismatch.sig,
      timestampHeader: String(mismatch.ts),
      rawBody: mismatch.rawBody,
      parsed: mismatch.parsed,
    })
    expect(conflict.ok).toBe(false)
    if (!conflict.ok) expect(conflict.code).toBe('CONFLICT')
  })
})

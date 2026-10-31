import { createHmac } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { hashSiteLeadIntakeSecret } from '@/lib/platform/site-leads/signature-auth'
import { buildSiteLeadSubmissionFingerprint } from '@/lib/platform/site-leads/fingerprint'
import { encodeSiteLeadListCursor } from '@/lib/platform/site-leads/cursor'
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
      findMany: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    managedSiteLeadIntakeCredential: { findUnique: vi.fn() },
    managedSite: { findFirst: vi.fn() },
    crmContact: { create: vi.fn() },
    crmContactChannelIdentity: { create: vi.fn() },
    crmContactSource: { create: vi.fn() },
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
  },
}))

vi.mock('@/lib/platform/site-leads/rate-limit', () => ({
  checkSiteLeadIntakeRateLimit: vi.fn(async () => ({ ok: true as const })),
}))

vi.mock('@/lib/platform/site-leads/crm-identity', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/platform/site-leads/crm-identity')>()
  return {
    ...actual,
    findExactAccountIdentityConflict: vi.fn(async () => null),
  }
})

import { prisma } from '@/lib/db'
import {
  conversionMustNotGrantMarketingConsent,
  findExactAccountIdentityConflict,
} from '@/lib/platform/site-leads/crm-identity'
import { checkSiteLeadIntakeRateLimit } from '@/lib/platform/site-leads/rate-limit'
import { ingestManagedSiteLead } from '@/lib/platform/site-leads/ingest-service'
import { listManagedSiteLeads } from '@/lib/platform/site-leads/list-service'
import { qualifySiteLead, rejectSiteLead } from '@/lib/platform/site-leads/workflow-service'
import { convertManagedSiteLeadToCrmContact } from '@/lib/platform/site-leads/convert-service'

function signedBody(body: object, secret = 'test-secret') {
  const rawBody = JSON.stringify(body)
  const ts = Math.floor(Date.now() / 1000)
  const sig = createHmac('sha256', secret).update(`${ts}.${rawBody}`).digest('hex')
  return { rawBody, ts, sig, parsed: body }
}

describe('Batch 28A.1 managed-site lead integrity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('SITE_LEAD_INTAKE_ENABLED', 'true')
    process.env.SITE_LEAD_INTAKE_SECRET_site_key_1 = 'test-secret'
    credential.secretHash = hashSiteLeadIntakeSecret('test-secret')
    vi.mocked(prisma.managedSiteLeadIntakeCredential.findUnique).mockResolvedValue(credential)
    vi.mocked(prisma.managedSite.findFirst).mockResolvedValue({
      id: 'site_a',
      domain: 'example.com',
    } as never)
  })

  it('rejects replay for existing idempotency key when HMAC is invalid', async () => {
    const fp = buildSiteLeadSubmissionFingerprint({
      customerAccountId: 'acct_a',
      managedSiteId: 'site_a',
      normalizedEmail: 'lead@example.com',
      normalizedPhone: null,
      formReference: null,
    })
    vi.mocked(prisma.managedSiteLead.findUnique).mockResolvedValue({
      id: 'lead_existing',
      status: 'RECEIVED',
      customerAccountId: 'acct_a',
      managedSiteId: 'site_a',
      submissionFingerprint: fp,
    } as never)
    const { rawBody, ts, parsed } = signedBody({ contactEmail: 'lead@example.com' })
    const result = await ingestManagedSiteLead({
      publicKeyId: 'site_key_1',
      idempotencyKeyHeader: 'idem-1',
      signatureHeader: 'bad-signature',
      timestampHeader: String(ts),
      rawBody,
      parsed,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('UNAUTHORIZED')
    expect(checkSiteLeadIntakeRateLimit).not.toHaveBeenCalled()
  })

  it('rejects replay when credential is revoked', async () => {
    vi.mocked(prisma.managedSiteLeadIntakeCredential.findUnique).mockResolvedValue({
      ...credential,
      revokedAt: new Date(),
    })
    const { rawBody, ts, sig, parsed } = signedBody({ contactEmail: 'lead@example.com' })
    const result = await ingestManagedSiteLead({
      publicKeyId: 'site_key_1',
      idempotencyKeyHeader: 'idem-1',
      signatureHeader: sig,
      timestampHeader: String(ts),
      rawBody,
      parsed,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('UNAUTHORIZED')
  })

  it('conflicts when the same idempotency key is reused with different content', async () => {
    const { rawBody, ts, sig, parsed } = signedBody({ contactEmail: 'other@example.com' })
    vi.mocked(prisma.managedSiteLead.findUnique).mockResolvedValue({
      id: 'lead_existing',
      status: 'RECEIVED',
      customerAccountId: 'acct_a',
      managedSiteId: 'site_a',
      submissionFingerprint: 'different-fingerprint',
    } as never)
    const result = await ingestManagedSiteLead({
      publicKeyId: 'site_key_1',
      idempotencyKeyHeader: 'idem-1',
      signatureHeader: sig,
      timestampHeader: String(ts),
      rawBody,
      parsed,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('CONFLICT')
  })

  it('handles concurrent same-key submission via unique constraint replay', async () => {
    const fp = buildSiteLeadSubmissionFingerprint({
      customerAccountId: 'acct_a',
      managedSiteId: 'site_a',
      normalizedEmail: 'lead@example.com',
      normalizedPhone: null,
      formReference: null,
    })
    vi.mocked(prisma.managedSiteLead.findUnique)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'lead_race',
        status: 'RECEIVED',
        customerAccountId: 'acct_a',
        managedSiteId: 'site_a',
        submissionFingerprint: fp,
      } as never)
    vi.mocked(prisma.managedSiteLead.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.managedSiteLead.create).mockRejectedValue({ code: 'P2002' })
    const { rawBody, ts, sig, parsed } = signedBody({ contactEmail: 'lead@example.com' })
    const result = await ingestManagedSiteLead({
      publicKeyId: 'site_key_1',
      idempotencyKeyHeader: 'idem-race',
      signatureHeader: sig,
      timestampHeader: String(ts),
      rawBody,
      parsed,
    })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.leadId).toBe('lead_race')
  })

  it('detects business duplicates across different idempotency keys', async () => {
    vi.mocked(prisma.managedSiteLead.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.managedSiteLead.findFirst).mockResolvedValue({ id: 'lead_dup' } as never)
    vi.mocked(prisma.managedSiteLead.create).mockResolvedValue({ id: 'lead_new', status: 'DUPLICATE_REVIEW' } as never)
    const { rawBody, ts, sig, parsed } = signedBody({ contactEmail: 'dup@example.com' })
    const result = await ingestManagedSiteLead({
      publicKeyId: 'site_key_1',
      idempotencyKeyHeader: 'idem-new',
      signatureHeader: sig,
      timestampHeader: String(ts),
      rawBody,
      parsed,
    })
    expect(result.ok).toBe(true)
    expect(prisma.managedSiteLead.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          idempotencyKey: { not: 'idem-new' },
        }),
      }),
    )
  })

  it('rejects malformed pagination cursors', async () => {
    const invalid = await listManagedSiteLeads({
      customerAccountId: 'acct_a',
      cursor: 'not-a-valid-cursor',
    })
    expect(invalid.ok).toBe(false)
    if (!invalid.ok) expect(invalid.code).toBe('VALIDATION')
  })

  it('paginates with composite cursor and rejects foreign-account cursors', async () => {
    const rows = [
      {
        id: 'z_last',
        createdAt: new Date('2026-10-31T12:00:00.000Z'),
        managedSiteId: 'site_a',
        status: 'RECEIVED' as const,
        locale: 'en',
        formReference: null,
        submittedAt: new Date('2026-10-31T11:00:00.000Z'),
        contactName: null,
        contactEmail: 'a@b.com',
        contactPhone: null,
        message: null,
        duplicateOfLeadId: null,
        crmContactId: null,
        convertedAt: null,
      },
    ]
    vi.mocked(prisma.managedSiteLead.findFirst).mockResolvedValue(null)
    const badCursor = encodeSiteLeadListCursor(new Date(), 'lead_other_acct')
    const invalid = await listManagedSiteLeads({
      customerAccountId: 'acct_a',
      cursor: badCursor,
    })
    expect(invalid.ok).toBe(false)

    vi.mocked(prisma.managedSiteLead.findFirst).mockResolvedValue({
      id: 'z_last',
      createdAt: new Date('2026-10-31T12:00:00.000Z'),
    } as never)
    vi.mocked(prisma.managedSiteLead.findMany).mockResolvedValue(rows as never)
    const page = await listManagedSiteLeads({
      customerAccountId: 'acct_a',
      cursor: encodeSiteLeadListCursor(new Date('2026-10-31T12:00:00.000Z'), 'z_last'),
      take: 10,
    })
    expect(page.ok).toBe(true)
    expect(prisma.managedSiteLead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        where: expect.objectContaining({ AND: expect.any(Array) }),
      }),
    )
  })

  it('prevents concurrent qualify from winning over reject', async () => {
    vi.mocked(prisma.managedSiteLead.updateMany)
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 })
    const reject = await rejectSiteLead('lead_1', 'acct_a')
    expect(reject.ok).toBe(true)
    const qualify = await qualifySiteLead('lead_1', 'acct_a')
    expect(qualify.ok).toBe(false)
    if (!qualify.ok) expect(qualify.code).toBe('CONFLICT')
  })

  it('routes CRM identity collision to DUPLICATE_REVIEW without granting consent', async () => {
    vi.mocked(prisma.managedSiteLead.findFirst)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'lead_1',
        customerAccountId: 'acct_a',
        managedSiteId: 'site_a',
        status: 'QUALIFIED',
        normalizedEmail: 'dup@example.com',
        normalizedPhone: null,
        contactEmail: 'dup@example.com',
        contactPhone: null,
        contactName: 'Test',
        locale: 'en',
        crmContactId: null,
      } as never)
    vi.mocked(findExactAccountIdentityConflict).mockResolvedValueOnce({
      contactId: 'crm_existing',
      via: 'email',
    })
    vi.mocked(prisma.managedSiteLead.updateMany).mockResolvedValue({ count: 1 })
    const result = await convertManagedSiteLeadToCrmContact({
      leadId: 'lead_1',
      customerAccountId: 'acct_a',
      actorUserId: 'user_1',
      idempotencyKey: 'convert-dup',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('CONFLICT')
    expect(prisma.managedSiteLead.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'DUPLICATE_REVIEW' } }),
    )
  })

  it('prevents qualify from overwriting converted leads', async () => {
    vi.mocked(prisma.managedSiteLead.updateMany).mockResolvedValue({ count: 0 })
    vi.mocked(prisma.managedSiteLead.findFirst).mockResolvedValue({ status: 'CONVERTED' } as never)
    const result = await qualifySiteLead('lead_1', 'acct_a')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('CONFLICT')
  })

  it('resolves concurrent reject versus convert via conditional updates', async () => {
    vi.mocked(prisma.managedSiteLead.updateMany)
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 })
    const reject = await rejectSiteLead('lead_1', 'acct_a')
    expect(reject.ok).toBe(true)

    vi.mocked(prisma.managedSiteLead.findFirst).mockResolvedValue({
      id: 'lead_1',
      customerAccountId: 'acct_a',
      managedSiteId: 'site_a',
      status: 'REJECTED',
      normalizedEmail: 'x@y.com',
      normalizedPhone: null,
      contactEmail: 'x@y.com',
      contactPhone: null,
      contactName: null,
      locale: 'en',
    } as never)
    const convert = await convertManagedSiteLeadToCrmContact({
      leadId: 'lead_1',
      customerAccountId: 'acct_a',
      actorUserId: 'user_1',
      idempotencyKey: 'convert-1',
    })
    expect(convert.ok).toBe(false)
    if (!convert.ok) expect(convert.code).toBe('CONFLICT')
  })

  it('preserves consent neutrality on conversion', () => {
    expect(conversionMustNotGrantMarketingConsent().ok).toBe(true)
  })
})

import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { hashSiteLeadIntakeSecret, verifySiteLeadIntakeSignature } from '@/lib/platform/site-leads/signature-auth'
import { validateSiteLeadIntakePayload } from '@/lib/platform/site-leads/validate-payload'
import { buildSiteLeadSubmissionFingerprint } from '@/lib/platform/site-leads/fingerprint'
import { parseSiteLeadStatusFilter } from '@/lib/platform/site-leads/list-service'
import {
  conversionMustNotGrantMarketingConsent,
  findExactAccountIdentityConflict,
} from '@/lib/platform/site-leads/crm-identity'
import { registerSalesLeadBridgeCandidate } from '@/lib/platform/crm/saleslead-bridge'

vi.mock('@/lib/db', () => ({
  prisma: {
    managedSiteLead: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
    managedSiteLeadIntakeCredential: { findUnique: vi.fn() },
    managedSite: { findFirst: vi.fn() },
    crmContactChannelIdentity: { findFirst: vi.fn() },
    crmContact: { create: vi.fn(), findFirst: vi.fn() },
    crmContactSource: { create: vi.fn() },
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
    salesLead: { findUnique: vi.fn() },
    crmSalesLeadBridge: { findUnique: vi.fn(), upsert: vi.fn() },
  },
}))

import { prisma } from '@/lib/db'
import { ingestManagedSiteLead } from '@/lib/platform/site-leads/ingest-service'

describe('Batch 28A managed-site leads', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('SITE_LEAD_INTAKE_ENABLED', 'true')
    process.env.SITE_LEAD_INTAKE_SECRET_site_key_1 = 'test-secret'
  })

  it('rejects client-supplied account or site ids in intake payload', () => {
    const rawBody = JSON.stringify({ contactEmail: 'a@b.com', customerAccountId: 'evil' })
    const result = validateSiteLeadIntakePayload({
      rawBody,
      parsed: JSON.parse(rawBody),
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('VALIDATION')
  })

  it('verifies HMAC signatures and rejects stale timestamps', () => {
    const secret = 'test-secret'
    const hash = hashSiteLeadIntakeSecret(secret)
    expect(hash).toHaveLength(64)
    const rawBody = '{"contactEmail":"a@b.com"}'
    const ts = Math.floor(Date.now() / 1000)
    const sig = createHmac('sha256', secret).update(`${ts}.${rawBody}`).digest('hex')
    expect(
      verifySiteLeadIntakeSignature({
        rawBody,
        signatureHeader: sig,
        timestampHeader: String(ts),
        secret,
      }).ok,
    ).toBe(true)
    expect(
      verifySiteLeadIntakeSignature({
        rawBody,
        signatureHeader: sig,
        timestampHeader: String(ts - 99999),
        secret,
      }).ok,
    ).toBe(false)
  })

  it('denies intake when credential site binding does not match account', async () => {
    vi.mocked(prisma.managedSiteLead.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.managedSiteLeadIntakeCredential.findUnique).mockResolvedValue({
      id: 'cred_1',
      publicKeyId: 'site_key_1',
      secretRef: null,
      secretHash: hashSiteLeadIntakeSecret('test-secret'),
      enabled: true,
      revokedAt: null,
      customerAccountId: 'acct_a',
      managedSiteId: 'site_a',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    vi.mocked(prisma.managedSite.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ requestCount: 1 }])

    const rawBody = JSON.stringify({ contactEmail: 'lead@example.com' })
    const ts = Math.floor(Date.now() / 1000)
    const sig = createHmac('sha256', 'test-secret').update(`${ts}.${rawBody}`).digest('hex')
    const result = await ingestManagedSiteLead({
      publicKeyId: 'site_key_1',
      idempotencyKeyHeader: 'idem-1',
      signatureHeader: sig,
      timestampHeader: String(ts),
      rawBody,
      parsed: JSON.parse(rawBody),
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('UNAUTHORIZED')
  })

  it('scopes list status filters to known lifecycle values', () => {
    expect(parseSiteLeadStatusFilter('received,qualified,bogus')).toEqual(['RECEIVED', 'QUALIFIED'])
  })

  it('builds account-scoped submission fingerprints per site', () => {
    const a = buildSiteLeadSubmissionFingerprint({
      managedSiteId: 'site_1',
      normalizedEmail: 'a@b.com',
      normalizedPhone: null,
      formReference: 'contact',
      dedupeKey: 'k1',
    })
    const b = buildSiteLeadSubmissionFingerprint({
      managedSiteId: 'site_2',
      normalizedEmail: 'a@b.com',
      normalizedPhone: null,
      formReference: 'contact',
      dedupeKey: 'k1',
    })
    expect(a).not.toBe(b)
  })

  it('does not grant marketing consent on conversion path', () => {
    expect(conversionMustNotGrantMarketingConsent().ok).toBe(true)
    const convert = readFileSync(join(process.cwd(), 'lib/platform/site-leads/convert-service.ts'), 'utf8')
    expect(convert).not.toContain('contactConsent')
    expect(convert).not.toContain('ContactConsent')
  })

  it('leaves WebXXL SalesLead intake module unchanged', () => {
    const intake = readFileSync(join(process.cwd(), 'lib/leads/intake.ts'), 'utf8')
    expect(intake).toContain('persistSalesLead')
    expect(intake).not.toContain('ManagedSiteLead')
  })

  it('blocks unowned SalesLead bridge without verified ownership', async () => {
    vi.mocked(prisma.salesLead.findUnique).mockResolvedValue({
      id: 'sl_1',
      customerAccountId: null,
    } as never)
    const result = await registerSalesLeadBridgeCandidate({
      customerAccountId: 'acct_a',
      salesLeadId: 'sl_1',
      idempotencyKey: 'bridge-1',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('FORBIDDEN')
  })

  it('returns disabled when site lead intake flag is off', async () => {
    vi.stubEnv('SITE_LEAD_INTAKE_ENABLED', 'false')
    const result = await ingestManagedSiteLead({
      publicKeyId: 'k',
      idempotencyKeyHeader: 'i',
      signatureHeader: 's',
      timestampHeader: '1',
      rawBody: '{}',
      parsed: {},
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('SITE_LEAD_INTAKE_DISABLED')
  })

  it('checks CRM identity conflicts within the customer account', async () => {
    vi.mocked(prisma.crmContactChannelIdentity.findFirst).mockResolvedValue({ contactId: 'c1' } as never)
    const conflict = await findExactAccountIdentityConflict({
      customerAccountId: 'acct_a',
      normalizedEmail: 'a@b.com',
      normalizedPhone: null,
    })
    expect(conflict).toEqual({ contactId: 'c1', via: 'email' })
    expect(prisma.crmContactChannelIdentity.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ customerAccountId: 'acct_a' }),
      }),
    )
  })
})

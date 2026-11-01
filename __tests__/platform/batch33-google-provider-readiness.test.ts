import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    siteAnalyticsConnection: { findMany: vi.fn().mockResolvedValue([]) },
    managedSite: { findMany: vi.fn().mockResolvedValue([]) },
    seoProviderSyncRun: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'sync' }),
      update: vi.fn(),
      upsert: vi.fn(),
    },
  },
}))

import {
  ABMED_AESTHETICS_ACCOUNT_ID,
  ABMED_PHYSICIANS_ACCOUNT_ID,
} from '@/lib/platform/fixtures/abmed'
import { denyBillingGroupSiblingAnalyticsAccess } from '@/lib/platform/analytics/account-isolation'
import { validateGoogleOAuthSecretRef } from '@/lib/platform/google/credential-ref'
import { assessGoogleCredentialLifecycle } from '@/lib/platform/google/credential-lifecycle'
import { validateGooglePropertyRef } from '@/lib/platform/google/property-ref'
import { assessGoogleProviderReadinessRow, assessGoogleSiteReadiness } from '@/lib/platform/google/readiness-assess'
import {
  parseGoogleReadinessProviders,
  runBoundedGoogleReadinessOperation,
} from '@/lib/platform/google/readiness-operation'
import { buildAbmedSeoSiblingIsolationCase } from '@/lib/platform/seo/test-fixtures-seo07'
import { createGoogleGa4SeoProvider } from '@/lib/platform/providers/google-ga4-seo'
import { createGoogleGbpSeoProvider } from '@/lib/platform/providers/google-gbp-seo'
import { prisma } from '@/lib/db'

const baseConnection = {
  id: 'conn-gsc',
  managedSiteId: 'site-a',
  customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
  provider: 'GSC' as const,
  propertyRef: 'sc-domain:example.test',
  propertyKind: 'DOMAIN',
  verificationState: 'VERIFIED',
  dataState: 'READY',
  lastVerifiedAt: new Date('2026-10-01T00:00:00.000Z'),
  revokedAt: null,
  secretRef: 'GOOGLE_OAUTH_TOKEN_REF',
  updatedAt: new Date('2026-10-15T00:00:00.000Z'),
}

describe('Batch 33 Google provider connection readiness', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  it('denies billing-group sibling access to Google readiness scope (OPEN-001 / tenant isolation)', () => {
    const iso = buildAbmedSeoSiblingIsolationCase()
    const denied = denyBillingGroupSiblingAnalyticsAccess({
      actorUserId: 'u1',
      operatingAccountId: iso.aestheticsAccountId,
      recordAccountId: iso.physiciansAccountId,
      operatingMemberships: [{ userId: 'u1', customerAccountId: iso.aestheticsAccountId }],
      billingGroupSiblingAccounts: iso.billingGroupSiblingAccounts,
    })
    expect(denied.ok).toBe(false)
    expect(ABMED_AESTHETICS_ACCOUNT_ID).not.toBe(ABMED_PHYSICIANS_ACCOUNT_ID)
  })

  it('rejects raw OAuth tokens in secretRef validation', () => {
    const bad = validateGoogleOAuthSecretRef('ya29.a0AfH6SMCfake-token')
    expect(bad.ok).toBe(false)
    const good = validateGoogleOAuthSecretRef('GOOGLE_OAUTH_TOKEN_REF')
    expect(good.ok).toBe(true)
    expect(good.ok && good.value.configured).toBe(true)
  })

  it('assesses GSC readiness as READY_FOR_INGEST when verified and mapped', () => {
    vi.stubEnv('GOOGLE_PROVIDER_READINESS_ENABLED', 'true')
    vi.stubEnv('SEO_GSC_API_ENABLED', 'true')
    vi.stubEnv('SEO_GOOGLE_OAUTH_ENABLED', 'true')
    const row = assessGoogleProviderReadinessRow({
      provider: 'GSC',
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      managedSiteId: 'site-a',
      authorizedHosts: ['example.test'],
      connections: [baseConnection],
    })
    expect(row.readinessState).toBe('READY_FOR_INGEST')
    expect(row.connection?.secretRefConfigured).toBe(true)
    expect(row.provenance).toBe('STORED_CONNECTION')
    expect(row.capabilities.liveOAuthActivation).toBe(false)
  })

  it('blocks readiness when credential lifecycle is revoked', () => {
    vi.stubEnv('GOOGLE_PROVIDER_READINESS_ENABLED', 'true')
    vi.stubEnv('SEO_GSC_API_ENABLED', 'true')
    vi.stubEnv('SEO_GOOGLE_OAUTH_ENABLED', 'true')
    const lifecycle = assessGoogleCredentialLifecycle({
      ...baseConnection,
      verificationState: 'REVOKED',
      revokedAt: new Date(),
    })
    expect(lifecycle.ok && lifecycle.value.lifecycle).toBe('REVOKED')
    const row = assessGoogleProviderReadinessRow({
      provider: 'GSC',
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      managedSiteId: 'site-a',
      authorizedHosts: ['example.test'],
      connections: [{ ...baseConnection, verificationState: 'REVOKED', revokedAt: new Date() }],
    })
    expect(row.readinessState).toBe('BLOCKED')
  })

  it('validates GA4 and GBP property reference formats', () => {
    expect(validateGooglePropertyRef('GA4', 'properties/123456789').ok).toBe(true)
    expect(validateGooglePropertyRef('GA4', 'invalid').ok).toBe(false)
    expect(validateGooglePropertyRef('GBP', 'locations/987654321').ok).toBe(true)
    expect(validateGooglePropertyRef('GBP', 'place:abc').ok).toBe(false)
  })

  it('marks GA4/GBP ingest as NOT_SUPPORTED while keeping connection boundaries', async () => {
    vi.stubEnv('SEO_GA4_API_ENABLED', 'true')
    vi.stubEnv('SEO_GBP_API_ENABLED', 'true')
    vi.stubEnv('SEO_GOOGLE_OAUTH_ENABLED', 'true')
    const ga4 = createGoogleGa4SeoProvider({
      resolveConnection: async () => ({
        customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
        managedSiteId: 'site-a',
        propertyRef: 'properties/123',
        verificationState: 'VERIFIED',
        dataState: 'READY',
        secretRef: 'GOOGLE_OAUTH_TOKEN_REF',
        revokedAt: null,
      }),
    })
    const ga4Overview = await ga4.readOverview({
      customerAccountId: ABMED_PHYSICIANS_ACCOUNT_ID,
      managedSiteId: 'site-a',
      actorId: 'u1',
      actorType: 'USER',
      requestId: 'r1',
      idempotencyKey: 'k1',
    })
    expect(ga4Overview.ok).toBe(false)

    const gbp = createGoogleGbpSeoProvider({
      resolveConnection: async () => ({
        customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
        managedSiteId: 'site-a',
        propertyRef: 'locations/999',
        verificationState: 'VERIFIED',
        dataState: 'READY',
        secretRef: 'GOOGLE_OAUTH_TOKEN_REF',
        revokedAt: null,
      }),
    })
    const gbpOverview = await gbp.readOverview({
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      managedSiteId: 'site-a',
      actorId: 'u1',
      actorType: 'USER',
      requestId: 'r1',
      idempotencyKey: 'k1',
    })
    expect(gbpOverview.ok).toBe(true)
    if (gbpOverview.ok) expect(gbpOverview.value.status).toBe('NOT_SUPPORTED')
  })

  it('runs bounded readiness operation without external fetch', async () => {
    vi.stubEnv('GOOGLE_PROVIDER_READINESS_ENABLED', 'true')
    vi.stubEnv('SEO_GSC_API_ENABLED', 'true')
    vi.stubEnv('SEO_GOOGLE_OAUTH_ENABLED', 'true')
    const parsed = parseGoogleReadinessProviders(['GSC'])
    expect(parsed.ok).toBe(true)
    const result = await runBoundedGoogleReadinessOperation({
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      managedSiteId: 'site-a',
      authorizedHosts: ['example.test'],
      connections: [baseConnection],
      providers: ['GSC'],
      clientRequestKey: 'batch33-test-key',
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.outcomes[0]?.externalFetchAttempted).toBe(false)
      expect(result.value.outcomes[0]?.syncRunStatus).toBe('READINESS_RECORDED')
      expect(result.value.outcomes[0]?.idempotencyKey).toContain('google-readiness:v1:')
    }
    expect(prisma.seoProviderSyncRun.create).toHaveBeenCalled()
  })

  it('assesses all three Google providers for a site', () => {
    vi.stubEnv('GOOGLE_PROVIDER_READINESS_ENABLED', 'true')
    vi.stubEnv('SEO_GSC_API_ENABLED', 'true')
    vi.stubEnv('SEO_GA4_API_ENABLED', 'true')
    vi.stubEnv('SEO_GBP_API_ENABLED', 'true')
    vi.stubEnv('SEO_GOOGLE_OAUTH_ENABLED', 'true')
    const site = assessGoogleSiteReadiness({
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      managedSiteId: 'site-a',
      authorizedHosts: ['example.test'],
      connections: [
        baseConnection,
        {
          ...baseConnection,
          id: 'conn-ga4',
          provider: 'GA4',
          propertyRef: 'properties/123456789',
          propertyKind: 'GA4_PROPERTY',
        },
      ],
    })
    expect(site.providers).toHaveLength(3)
    expect(site.providers.map((p) => p.provider)).toEqual(['GSC', 'GA4', 'GBP'])
  })
})

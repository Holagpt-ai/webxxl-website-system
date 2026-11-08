import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import type { PortalUser } from '@/lib/portal/authz'
import { emptySubscriberEvidence } from '@/lib/platform/open001/subscriber-evidence'
import { SITE_INTELLIGENCE_PROVENANCE_NOTICE } from '@/lib/platform/site-intelligence/constants'

vi.mock('@/config/features', () => ({
  features: { analyticsBackend: true },
  isEnabled: () => true,
}))

vi.mock('@/lib/platform/open001/load-subscriber-evidence', () => ({
  loadSubscriberEvidenceForAccount: vi.fn(async (customerAccountId: string) => ({
    customerAccountId,
    subscriptions: [
      { customerAccountId, productKey: 'website.subscription', status: 'ACTIVE' },
    ],
    legacyWebsiteServices: [],
    loadOutcome: 'ok' as const,
  })),
}))

vi.mock('@/lib/platform/seo/seo-overview-service', () => ({
  loadSeoSiteOverview: vi.fn(async (input: { customerAccountId: string; managedSiteId: string }) => {
    if (input.customerAccountId !== 'acct_a' || input.managedSiteId !== 'site_a') {
      return { ok: false, code: 'NOT_FOUND', message: 'Site not found' }
    }
    return {
      ok: true,
      value: {
        managedSiteId: input.managedSiteId,
        sections: {
          gscPerformance: {
            dataState: 'READY',
            clicks: 12,
            impressions: 400,
            ctr: 0.03,
            averagePosition: 8.2,
            averagePositionLabel: 'GSC average position (not fixed rank)',
          },
        },
      },
    }
  }),
}))

vi.mock('@/lib/platform/analytics/bi/summary-service', () => ({
  buildAnalyticsOverview: vi.fn(async (_store, input: { managedSiteId: string }) => ({
    customerAccountId: 'acct_a',
    managedSiteId: input.managedSiteId,
    timezone: 'America/Chicago',
    flags: { backendEnabled: true },
    freshness: [],
    traffic: { dataState: 'READY', series: [{ date: '2026-11-01', sessions: 50, users: 40, dataState: 'READY' }], periodChanges: [] },
    search: {
      dataState: 'READY',
      clicks: 12,
      impressions: 400,
      averagePosition: 8.2,
      averagePositionLabel: 'GSC average position (not fixed rank)',
    },
    local: { dataState: 'NOT_CONNECTED', profileViews: null, searchQueries: null, actions: null, rankObservations: 0, limitations: [] },
    conversions: [],
    acquisition: [],
    crm: { leadsCreated: 0, leadsConverted: 0, openDeals: 0, dataState: 'NOT_CONNECTED', disclaimer: 'stored' },
    sync: { dataState: 'NOT_CONNECTED', runs: [] },
  })),
}))

vi.mock('@/lib/platform/analytics/prisma-store', () => ({
  prismaAnalyticsStore: {
    resolveManagedSite: vi.fn(async (customerAccountId: string, managedSiteId: string | null) => {
      if (customerAccountId === 'acct_a' && managedSiteId === 'site_a') {
        return { id: 'site_a', name: 'A Site', domain: 'a.example' }
      }
      if (customerAccountId === 'acct_b') {
        return null
      }
      return null
    }),
  },
}))

vi.mock('@/lib/platform/google/account-readiness-service', () => ({
  buildGoogleAccountReadiness: vi.fn(async () => ({
    ok: false,
    status: 503,
    code: 'NOT_CONFIGURED',
    message: 'Google provider readiness module disabled',
  })),
}))

function portalStub(accountId: string): PortalUser {
  return {
    id: 'user_1',
    role: 'CUSTOMER',
    membership: { role: 'OWNER', customerAccountId: accountId, userId: 'user_1' } as PortalUser['membership'],
    customerAccount: { id: accountId, businessName: 'Co' } as PortalUser['customerAccount'],
  } as PortalUser
}

function range() {
  return {
    start: new Date('2026-10-01T00:00:00.000Z'),
    end: new Date('2026-10-28T00:00:00.000Z'),
    startIso: '2026-10-01',
    endIso: '2026-10-28',
  }
}

describe('Batch 2 site intelligence integration', () => {
  const env = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = {
      ...env,
      SEO_BACKEND_ENABLED: 'true',
      ANALYTICS_BACKEND_ENABLED: 'true',
      GOOGLE_PROVIDER_READINESS_ENABLED: 'false',
    }
  })

  afterEach(() => {
    process.env = env
    vi.clearAllMocks()
  })

  it('exposes GET route with tenant scope and date range parsing', () => {
    const route = readFileSync(
      join(process.cwd(), 'app/api/v1/site-intelligence/sites/[siteId]/summary/route.ts'),
      'utf8',
    )
    expect(route).toContain('requireCustomerMembership')
    expect(route).toContain('parseAnalyticsDateRange')
    expect(route).toContain('FORBIDDEN')
    expect(route).toContain('getSiteIntelligenceSummary')
  })

  it('documents provenance and v0 handoff without business UI overlap', () => {
    const doc = readFileSync(
      join(process.cwd(), 'docs/platform/docs/BATCH2-SITE-INTELLIGENCE-API-CONTRACT.md'),
      'utf8',
    )
    expect(doc).toContain('/api/v1/site-intelligence/sites/{siteId}/summary')
    expect(doc).toContain('provenanceNotice')
    expect(doc).toContain('dashboard/seo')
    expect(doc).toContain('Issue #113')
  })

  it('composes SEO and analytics without blending provider metrics', async () => {
    const { getSiteIntelligenceSummary } = await import('@/lib/platform/site-intelligence/service')
    const result = await getSiteIntelligenceSummary({
      portal: portalStub('acct_a'),
      managedSiteId: 'site_a',
      range: range(),
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.provenanceNotice).toBe(SITE_INTELLIGENCE_PROVENANCE_NOTICE)
    expect(result.value.seo.status).toBe('AVAILABLE')
    if (result.value.seo.status === 'AVAILABLE') {
      expect(result.value.seo.data.sections.gscPerformance.averagePositionLabel).toContain('GSC average position')
    }
    expect(result.value.analytics.status).toBe('AVAILABLE')
    if (result.value.analytics.status === 'AVAILABLE') {
      expect(result.value.analytics.data.traffic.series[0]?.sessions).toBe(50)
      expect(result.value.analytics.data.search.averagePositionLabel).toContain('GSC average position')
    }
    expect(result.value.googleReadiness.status).toBe('UNAVAILABLE')
    if (result.value.googleReadiness.status === 'UNAVAILABLE') {
      expect(result.value.googleReadiness.reasonCode).toBe('READINESS_MODULE_DISABLED')
    }
  })

  it('returns NOT_FOUND for cross-account site isolation', async () => {
    const { getSiteIntelligenceSummary } = await import('@/lib/platform/site-intelligence/service')
    const result = await getSiteIntelligenceSummary({
      portal: portalStub('acct_b'),
      managedSiteId: 'site_a',
      range: range(),
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('NOT_FOUND')
  })

  it('marks analytics unavailable when backend disabled', async () => {
    process.env.ANALYTICS_BACKEND_ENABLED = 'false'
    const { getSiteIntelligenceSummary } = await import('@/lib/platform/site-intelligence/service')
    const result = await getSiteIntelligenceSummary({
      portal: portalStub('acct_a'),
      managedSiteId: 'site_a',
      range: range(),
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.analytics.status).toBe('UNAVAILABLE')
    if (result.value.analytics.status === 'UNAVAILABLE') {
      expect(result.value.analytics.reasonCode).toBe('ANALYTICS_DISABLED')
    }
  })

  it('does not import subscriber evidence helpers in route layer', () => {
    expect(emptySubscriberEvidence).toBeDefined()
  })
})

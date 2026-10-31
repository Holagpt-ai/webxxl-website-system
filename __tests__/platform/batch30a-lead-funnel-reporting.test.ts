import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PortalUser } from '@/lib/portal/authz'
import { emptySubscriberEvidence } from '@/lib/platform/open001/subscriber-evidence'
import { getBusinessOverview } from '@/lib/platform/business-overview/service'
import type { BusinessOverviewDataAccess } from '@/lib/platform/business-overview/data-access'
import { parseSiteLeadFunnelDateRange } from '@/lib/platform/site-leads/funnel-date-range'
import {
  countManagedSiteLeadStatusBundle,
  siteLeadStatusCountBundleFromStatusMap,
} from '@/lib/platform/site-leads/funnel-metrics'
import {
  cohortWhere,
  getManagedSiteLeadFunnelReport,
  loadSiteLeadFunnelGroupBreakdown,
} from '@/lib/platform/site-leads/funnel-report-service'
import { loadWebsiteLeadOverviewAttachment } from '@/lib/platform/site-leads/overview-leads'
import { BUSINESS_DESTINATIONS } from '@/lib/platform/business-overview/destinations'

vi.mock('@/lib/db', () => ({
  prisma: {
    managedSiteLead: {
      count: vi.fn(),
      findMany: vi.fn(),
      groupBy: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}))

vi.mock('@/lib/managed-sites/queries', () => ({
  getManagedSiteForAccount: vi.fn(async (siteId: string, accountId: string) =>
    siteId === 'site_a' && accountId === 'acct_a' ? { id: siteId, customerAccountId: accountId } : null,
  ),
}))

import { prisma } from '@/lib/db'

const portal: PortalUser = {
  id: 'user_1',
  role: 'CUSTOMER',
  membership: { role: 'OWNER', customerAccountId: 'acct_a', userId: 'user_1' } as PortalUser['membership'],
  customerAccount: { id: 'acct_a', businessName: 'A Co' } as PortalUser['customerAccount'],
} as PortalUser

vi.mock('@/lib/platform/business-overview/access', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/platform/business-overview/access')>()
  return {
    ...actual,
    loadModuleAccessContext: vi.fn(async (p: PortalUser) => ({
      portal: p,
      evidence: emptySubscriberEvidence(p.customerAccount.id),
      isStaff: false,
    })),
    resolveCrmModuleAccess: () => 'proceed' as const,
    resolveMarketingModuleAccess: () => 'proceed' as const,
    resolveSeoModuleAccess: () => 'proceed' as const,
    resolveCommsModuleAccess: () => 'proceed' as const,
    marketingViewerCanDecide: () => true,
  }
})

function baseDataAccess(overrides: Partial<BusinessOverviewDataAccess> = {}): BusinessOverviewDataAccess {
  const noop = {
    countCrmOpenTasks: vi.fn(async () => 0),
    fetchCrmOpenTasks: vi.fn(async () => []),
    countCrmOpenDeals: vi.fn(async () => 0),
    fetchCrmOpenDeals: vi.fn(async () => []),
    countPendingMergeProposals: vi.fn(async () => 0),
    fetchPendingMergeProposals: vi.fn(async () => []),
    countMarketingDraftRequests: vi.fn(async () => 0),
    fetchMarketingDraftRequests: vi.fn(async () => []),
    countMarketingSubmittedReviews: vi.fn(async () => 0),
    countMarketingDraftArtifacts: vi.fn(async () => 0),
    fetchMarketingReviews: vi.fn(async () => ({ ok: true as const, value: { reviews: [] } })),
    fetchMarketingDraftArtifacts: vi.fn(async () => ({ ok: true as const, value: { artifacts: [] } })),
    countSeoActionableOpportunities: vi.fn(async () => 0),
    fetchSeoActionableOpportunities: vi.fn(async () => []),
    countCommsInboxes: vi.fn(async () => 0),
    countCommsNeedsAttentionConversations: vi.fn(async () => 0),
    fetchCommsInboxes: vi.fn(async () => ({ ok: true as const, value: { inboxes: [] } })),
    fetchCommsNeedsAttentionConversations: vi.fn(async () => ({ ok: true as const, value: { conversations: [] } })),
    countPendingProjectApprovals: vi.fn(async () => 0),
    fetchPendingProjectApprovals: vi.fn(async () => []),
    countOpenProjectDependencies: vi.fn(async () => 0),
    fetchOpenProjectDependencies: vi.fn(async () => []),
  }
  return { ...noop, ...overrides } as BusinessOverviewDataAccess
}

const defaultRange = {
  createdFrom: new Date('2026-10-01T00:00:00.000Z'),
  createdToExclusive: new Date('2026-11-01T00:00:00.000Z'),
  createdFromIso: '2026-10-01',
  createdToInclusiveIso: '2026-10-31',
}

describe('Batch 30A lead funnel reporting', () => {
  let countMock: ReturnType<typeof vi.fn>
  let groupByMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRM_BACKEND_ENABLED = 'true'
    process.env.SITE_LEAD_INTAKE_ENABLED = 'false'
    countMock = vi.mocked(prisma.managedSiteLead.count) as unknown as ReturnType<typeof vi.fn>
    groupByMock = vi.mocked(prisma.managedSiteLead.groupBy) as unknown as ReturnType<typeof vi.fn>
    countMock.mockImplementation(async (args: { where?: { status?: string | { in: string[] }; customerAccountId?: string } }) => {
      const where = args?.where
      if (where?.status === 'CONVERTED') return 2
      if (where?.status === 'QUALIFIED') return 3
      if (where?.status === 'REJECTED') return 1
      if (where?.status === 'DUPLICATE_REVIEW') return 1
      if (typeof where?.status === 'object' && where.status.in) return 4
      if (where?.customerAccountId === 'acct_a') return 10
      if (where?.customerAccountId === 'acct_b') return 99
      return 0
    })
    groupByMock.mockResolvedValue([
      { managedSiteId: 'site_a', status: 'RECEIVED', _count: { _all: 3 } },
      { managedSiteId: 'site_a', status: 'QUALIFIED', _count: { _all: 2 } },
      { formReference: 'hero-form', status: 'RECEIVED', _count: { _all: 4 } },
    ] as never)
    vi.mocked(prisma.managedSiteLead.findMany).mockResolvedValue([
      {
        id: 'lead_1',
        status: 'RECEIVED',
        formReference: 'contact',
        createdAt: new Date('2026-10-01T00:00:00.000Z'),
      },
    ] as never)
    vi.mocked(prisma.$queryRaw).mockResolvedValue([
      { day: new Date('2026-10-01T00:00:00.000Z'), count: BigInt(5) },
    ] as never)
  })

  it('parses bounded date ranges and rejects spans over the configured maximum', () => {
    const ok = parseSiteLeadFunnelDateRange({
      createdFromRaw: '2026-01-01',
      createdToRaw: '2026-01-31',
      now: new Date('2026-02-01T12:00:00.000Z'),
    })
    expect(ok.ok).toBe(true)
    const fail = parseSiteLeadFunnelDateRange({
      createdFromRaw: '2020-01-01',
      createdToRaw: '2026-01-01',
      now: new Date('2026-01-02T00:00:00.000Z'),
    })
    expect(fail.ok).toBe(false)
  })

  it('builds lifecycle bundles from grouped status rows without extra count queries', () => {
    const bundle = siteLeadStatusCountBundleFromStatusMap({
      RECEIVED: 3,
      QUALIFIED: 2,
      DUPLICATE_REVIEW: 1,
    })
    expect(bundle.leadsReceived).toBe(6)
    expect(bundle.qualified).toBe(2)
    expect(bundle.awaitingReview).toBe(4)
    expect(bundle.duplicateReview).toBe(1)
  })

  it('applies site and form filters together on cohort queries', async () => {
    const ok = await getManagedSiteLeadFunnelReport({
      customerAccountId: 'acct_a',
      managedSiteId: 'site_a',
      formReference: 'hero-form',
      createdFromRaw: '2026-10-01',
      createdToRaw: '2026-10-31',
    })
    expect(ok.ok).toBe(true)
    expect(cohortWhere({ customerAccountId: 'acct_a', managedSiteId: 'site_a', formReference: 'hero-form', range: defaultRange })).toMatchObject({
      customerAccountId: 'acct_a',
      managedSiteId: 'site_a',
      formReference: 'hero-form',
    })
  })

  it('constrains form breakdowns to the selected managed site', async () => {
    await getManagedSiteLeadFunnelReport({
      customerAccountId: 'acct_a',
      managedSiteId: 'site_a',
      createdFromRaw: '2026-10-01',
      createdToRaw: '2026-10-31',
    })
    const formBreakdownCall = groupByMock.mock.calls.find(
      (call) => (call[0] as { by?: string[] }).by?.includes('formReference'),
    )?.[0] as { where?: Record<string, unknown> }
    expect(formBreakdownCall?.where).toMatchObject({
      customerAccountId: 'acct_a',
      managedSiteId: 'site_a',
    })
  })

  it('constrains site breakdowns to the selected form reference', async () => {
    await getManagedSiteLeadFunnelReport({
      customerAccountId: 'acct_a',
      formReference: 'hero-form',
      createdFromRaw: '2026-10-01',
      createdToRaw: '2026-10-31',
    })
    const siteBreakdownCall = groupByMock.mock.calls.find(
      (call) => (call[0] as { by?: string[] }).by?.includes('managedSiteId'),
    )?.[0] as { where?: Record<string, unknown> }
    expect(siteBreakdownCall?.where).toMatchObject({
      customerAccountId: 'acct_a',
      formReference: 'hero-form',
    })
  })

  it('uses one groupBy per breakdown dimension instead of per-group count loops', async () => {
    groupByMock.mockResolvedValueOnce([
      { formReference: 'contact', status: 'RECEIVED', _count: { _all: 5 } },
      { formReference: 'contact', status: 'CONVERTED', _count: { _all: 1 } },
    ] as never)
    const rows = await loadSiteLeadFunnelGroupBreakdown({
      filters: { customerAccountId: 'acct_a', managedSiteId: 'site_a', range: defaultRange },
      groupField: 'formReference',
    })
    expect(groupByMock).toHaveBeenCalledTimes(1)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.key).toBe('contact')
    expect(rows[0]?.counts.leadsReceived).toBe(6)
    expect(rows[0]?.counts.converted).toBe(1)
    expect(countMock).not.toHaveBeenCalled()
  })

  it('does not leak counts across customer accounts in count helpers', async () => {
    const a = await countManagedSiteLeadStatusBundle({ customerAccountId: 'acct_a' })
    const b = await countManagedSiteLeadStatusBundle({ customerAccountId: 'acct_b' })
    expect(a.leadsReceived).toBe(10)
    expect(b.leadsReceived).toBe(99)
  })

  it('keeps CRM module available when lead tables fail while preserving independent lead reporting readiness', async () => {
    countMock.mockRejectedValueOnce({ code: 'P2021' })
    const overview = await getBusinessOverview(portal, baseDataAccess())
    const crm = overview.modules.find((m) => m.module === 'crm')!
    expect(crm.readiness.state).toBe('available')
    expect(crm.summary?.openTasks).toEqual({ value: 0, scope: 'account_total' })
    expect(crm.websiteLeadReporting?.readiness.state).toBe('unavailable')
    expect(crm.summary?.websiteLeadsReceived).toBeUndefined()
    const leadReadiness = crm.websiteLeadReporting?.readiness
    expect(leadReadiness?.state).toBe('unavailable')
    if (leadReadiness && leadReadiness.state !== 'available') {
      expect(leadReadiness.message).not.toMatch(/P2021/)
    }
  })

  it('keeps CRM module available when lead reporting throws an unexpected database error', async () => {
    countMock.mockRejectedValueOnce(new Error('connection reset'))
    const overview = await getBusinessOverview(portal, baseDataAccess())
    const crm = overview.modules.find((m) => m.module === 'crm')!
    expect(crm.readiness.state).toBe('available')
    expect(crm.websiteLeadReporting?.readiness.state).toBe('unavailable')
    const leadReadiness = crm.websiteLeadReporting?.readiness
    if (leadReadiness && leadReadiness.state !== 'available') {
      expect(leadReadiness.message).toContain('temporarily unavailable')
    }
  })

  it('routes Business Command Center lead actions to the Lead Inbox with recordRef id', async () => {
    const overview = await getBusinessOverview(portal, baseDataAccess())
    const leadActions = overview.actions.filter((a) => a.actionType.startsWith('crm.website_lead'))
    expect(leadActions.length).toBeGreaterThan(0)
    expect(leadActions[0]?.destination.path).toBe(BUSINESS_DESTINATIONS.crmLeads)
    expect(leadActions[0]?.recordRef).toEqual({ kind: 'managed_site_lead', id: 'lead_1' })
  })

  it('sanitizes overview attachment failures without internal database errors', async () => {
    countMock.mockRejectedValueOnce({ code: 'P2021' })
    const attachment = await loadWebsiteLeadOverviewAttachment({
      customerAccountId: 'acct_a',
      checkedAt: new Date().toISOString(),
    })
    expect(attachment.summaryMetrics).toEqual({})
    expect(attachment.reporting.readiness.state).toBe('unavailable')
    const readiness = attachment.reporting.readiness
    if (readiness.state !== 'available') {
      expect(readiness.message).not.toMatch(/P2021/)
    }
  })

  it('exposes funnel-report route with reporting auth separate from intake activation flag', () => {
    const { readFileSync } = require('node:fs')
    const { join } = require('node:path')
    const route = readFileSync(join(process.cwd(), 'app/api/v1/site-leads/funnel-report/route.ts'), 'utf8')
    expect(route).toContain('requireSiteLeadReportingActor')
    expect(route).not.toContain('requireSiteLeadInboxActor')
  })
})

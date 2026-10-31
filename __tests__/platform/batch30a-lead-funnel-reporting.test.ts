import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PortalUser } from '@/lib/portal/authz'
import { emptySubscriberEvidence } from '@/lib/platform/open001/subscriber-evidence'
import { getBusinessOverview } from '@/lib/platform/business-overview/service'
import type { BusinessOverviewDataAccess } from '@/lib/platform/business-overview/data-access'
import { parseSiteLeadFunnelDateRange } from '@/lib/platform/site-leads/funnel-date-range'
import { countManagedSiteLeadStatusBundle } from '@/lib/platform/site-leads/funnel-metrics'
import { getManagedSiteLeadFunnelReport } from '@/lib/platform/site-leads/funnel-report-service'

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

describe('Batch 30A lead funnel reporting', () => {
  let countMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRM_BACKEND_ENABLED = 'true'
    process.env.SITE_LEAD_INTAKE_ENABLED = 'false'
    countMock = vi.mocked(prisma.managedSiteLead.count) as unknown as ReturnType<typeof vi.fn>
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
    vi.mocked(prisma.managedSiteLead.findMany).mockResolvedValue([
      {
        id: 'lead_1',
        status: 'RECEIVED',
        formReference: 'contact',
        createdAt: new Date('2026-10-01T00:00:00.000Z'),
        submittedAt: new Date('2026-10-01T00:00:00.000Z'),
      },
    ] as never)
    vi.mocked(prisma.managedSiteLead.groupBy).mockResolvedValue([
      { managedSiteId: 'site_a', _count: { _all: 5 } },
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

  it('computes exact account-wide status counts without double-counting duplicate review separately from totals', async () => {
    const counts = await countManagedSiteLeadStatusBundle({ customerAccountId: 'acct_a' })
    expect(counts.leadsReceived).toBe(10)
    expect(counts.duplicateReview).toBe(1)
    expect(counts.awaitingReview).toBe(4)
  })

  it('scopes funnel report queries to the customer account and optional managed site', async () => {
    const denied = await getManagedSiteLeadFunnelReport({
      customerAccountId: 'acct_a',
      managedSiteId: 'site_other',
      createdFromRaw: '2026-10-01',
      createdToRaw: '2026-10-31',
    })
    expect(denied.ok).toBe(false)
    if (!denied.ok) expect(denied.code).toBe('FORBIDDEN')

    const ok = await getManagedSiteLeadFunnelReport({
      customerAccountId: 'acct_a',
      managedSiteId: 'site_a',
      formReference: 'hero-form',
      createdFromRaw: '2026-10-01',
      createdToRaw: '2026-10-31',
    })
    expect(ok.ok).toBe(true)
    expect(prisma.managedSiteLead.count).toHaveBeenCalled()
    const firstCall = vi.mocked(prisma.managedSiteLead.count).mock.calls[0]?.[0]
    expect(firstCall?.where).toMatchObject({
      customerAccountId: 'acct_a',
      managedSiteId: 'site_a',
      formReference: 'hero-form',
    })
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
  })

  it('attaches website lead metrics and bounded actions when lead reporting succeeds', async () => {
    const overview = await getBusinessOverview(portal, baseDataAccess())
    const crm = overview.modules.find((m) => m.module === 'crm')!
    expect(crm.websiteLeadReporting?.readiness.state).toBe('available')
    expect(crm.summary?.websiteLeadsReceived).toEqual({ value: 10, scope: 'account_total' })
    expect(crm.summary?.websiteLeadsAwaitingReview).toEqual({ value: 4, scope: 'account_total' })
    const leadActions = overview.actions.filter((a) => a.actionType.startsWith('crm.website_lead'))
    expect(leadActions.length).toBeGreaterThan(0)
    expect(leadActions[0]?.destination.path).toContain('/dashboard/crm/leads/')
  })

  it('exposes funnel-report route with reporting auth separate from intake activation flag', () => {
    const { readFileSync } = require('node:fs')
    const { join } = require('node:path')
    const route = readFileSync(join(process.cwd(), 'app/api/v1/site-leads/funnel-report/route.ts'), 'utf8')
    expect(route).toContain('requireSiteLeadReportingActor')
    expect(route).not.toContain('requireSiteLeadInboxActor')
  })
})

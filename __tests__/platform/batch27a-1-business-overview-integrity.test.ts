import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PortalUser } from '@/lib/portal/authz'
import { emptySubscriberEvidence } from '@/lib/platform/open001/subscriber-evidence'
import {
  BUSINESS_OVERVIEW_MAX_ACTIONS,
  BUSINESS_OVERVIEW_MAX_ACTIONS_PER_MODULE,
} from '@/lib/platform/business-overview/constants'
import type { BusinessOverviewDataAccess } from '@/lib/platform/business-overview/data-access'
import { getBusinessOverview } from '@/lib/platform/business-overview/service'

const portal: PortalUser = {
  id: 'user_1',
  role: 'CUSTOMER',
  membership: { role: 'OWNER', customerAccountId: 'acct_a', userId: 'user_1' } as PortalUser['membership'],
  customerAccount: { id: 'acct_a', businessName: 'A Co' } as PortalUser['customerAccount'],
} as PortalUser

vi.mock('@/lib/platform/site-leads/overview-leads', () => ({
  loadWebsiteLeadOverviewAttachment: vi.fn(async () => ({
    summaryMetrics: {},
    actions: [],
    reporting: {
      readiness: { state: 'unavailable', reasonCode: 'TEST_SKIP', message: 'Lead reporting not under test in 27A.1' },
    },
  })),
}))

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
  const noopRows = {
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
  return { ...noopRows, ...overrides } as BusinessOverviewDataAccess
}

describe('Batch 27A.1 business overview integrity', () => {
  beforeEach(() => {
    process.env.CRM_BACKEND_ENABLED = 'true'
    process.env.MKT_BACKEND_ENABLED = 'true'
    process.env.SEO_BACKEND_ENABLED = 'true'
    process.env.COMMS_BACKEND_ENABLED = 'true'
  })

  it('caps actions globally and per module when many CRM tasks exist', async () => {
    const manyTasks = Array.from({ length: 30 }, (_, i) => ({
      id: `task_${i}`,
      title: `Task ${i}`,
      dueAt: new Date('2026-11-01T00:00:00.000Z'),
      updatedAt: new Date('2026-10-31T00:00:00.000Z'),
      status: 'OPEN' as const,
    }))
    const data = baseDataAccess({
      countCrmOpenTasks: vi.fn(async () => 30),
      fetchCrmOpenTasks: vi.fn(async () => manyTasks.slice(0, 12) as Awaited<ReturnType<BusinessOverviewDataAccess['fetchCrmOpenTasks']>>),
    })
    const overview = await getBusinessOverview(portal, data)
    expect(overview.actions.length).toBeLessThanOrEqual(BUSINESS_OVERVIEW_MAX_ACTIONS)
    const crmActions = overview.actions.filter((a) => a.module === 'crm')
    expect(crmActions.length).toBeLessThanOrEqual(BUSINESS_OVERVIEW_MAX_ACTIONS_PER_MODULE)
    const crm = overview.modules.find((m) => m.module === 'crm')
    expect(crm?.summary?.openTasks).toEqual({ value: 30, scope: 'account_total' })
    expect(crm?.summary?.openTasksSample?.scope).toBe('bounded_sample')
  })

  it('uses account totals in summary distinct from bounded action samples', async () => {
    const data = baseDataAccess({
      countPendingMergeProposals: vi.fn(async () => 20),
      fetchPendingMergeProposals: vi.fn(async () => [{ id: 'm1', createdAt: new Date('2026-10-31T00:00:00.000Z') }]),
    })
    const overview = await getBusinessOverview(portal, data)
    const crm = overview.modules.find((m) => m.module === 'crm')!
    expect(crm.summary?.pendingMerges).toEqual({ value: 20, scope: 'account_total' })
    expect(crm.summary?.pendingMergesSample).toEqual({ value: 1, scope: 'bounded_sample' })
    expect(data.fetchPendingMergeProposals).toHaveBeenCalledWith('acct_a')
    expect(data.countPendingMergeProposals).toHaveBeenCalledWith('acct_a')
  })

  it('does not call unbounded merge proposal listing', async () => {
    const data = baseDataAccess({
      fetchPendingMergeProposals: vi.fn(async () => []),
    })
    await getBusinessOverview(portal, data)
    expect(data.fetchPendingMergeProposals).toHaveBeenCalledTimes(1)
  })

  it('marks marketing unavailable when review list fails', async () => {
    const data = baseDataAccess({
      fetchMarketingReviews: vi.fn(async () => ({ ok: false as const, code: 'NOT_CONFIGURED' as const, message: 'db down' })),
    })
    const overview = await getBusinessOverview(portal, data)
    const marketing = overview.modules.find((m) => m.module === 'marketing')!
    expect(marketing.readiness.state).toBe('unavailable')
    expect(marketing.summary).toBeUndefined()
    expect(overview.modules.find((m) => m.module === 'website_projects')?.readiness.state).toBe('available')
  })

  it('marks communications unavailable when inbox list fails', async () => {
    const data = baseDataAccess({
      fetchCommsInboxes: vi.fn(async () => ({ ok: false as const, code: 'NOT_CONFIGURED' as const, message: 'db down' })),
    })
    const overview = await getBusinessOverview(portal, data)
    const comms = overview.modules.find((m) => m.module === 'communications')!
    expect(comms.readiness.state).toBe('unavailable')
    expect(overview.modules.find((m) => m.module === 'crm')?.readiness.state).toBe('available')
  })

  it('passes session customerAccountId to all data access calls', async () => {
    const data = baseDataAccess()
    await getBusinessOverview(portal, data)
    expect(data.countCrmOpenTasks).toHaveBeenCalledWith('acct_a')
    expect(data.fetchMarketingDraftRequests).toHaveBeenCalledWith('acct_a')
    expect(data.countPendingProjectApprovals).toHaveBeenCalledWith('acct_a')
  })
})

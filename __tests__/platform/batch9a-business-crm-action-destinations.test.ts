import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { PortalUser } from '@/lib/portal/authz'
import { emptySubscriberEvidence } from '@/lib/platform/open001/subscriber-evidence'
import type { BusinessOverviewDataAccess } from '@/lib/platform/business-overview/data-access'
import { BUSINESS_DESTINATIONS } from '@/lib/platform/business-overview/destinations'
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
      readiness: { state: 'unavailable', reasonCode: 'TEST_SKIP', message: 'skipped' },
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

describe('Batch 9A business CRM action destinations', () => {
  beforeEach(() => {
    process.env.CRM_BACKEND_ENABLED = 'true'
    process.env.MKT_BACKEND_ENABLED = 'true'
    process.env.SEO_BACKEND_ENABLED = 'true'
    process.env.COMMS_BACKEND_ENABLED = 'true'
  })

  it('encodes record-scoped CRM destinations', () => {
    expect(BUSINESS_DESTINATIONS.crmTask('t_1')).toBe('/dashboard/crm/tasks?taskId=t_1')
    expect(BUSINESS_DESTINATIONS.crmDeal('d_1')).toBe('/dashboard/crm/pipeline?dealId=d_1')
    expect(BUSINESS_DESTINATIONS.crmMergeProposal('m_1')).toBe('/dashboard/crm/merges?proposalId=m_1')
    expect(BUSINESS_DESTINATIONS.crmLead('l_1')).toBe('/dashboard/crm/leads?leadId=l_1')
  })

  it('emits record-scoped paths on business overview CRM actions', async () => {
    const updatedAt = new Date('2026-10-31T00:00:00.000Z')
    const data = baseDataAccess({
      fetchCrmOpenTasks: vi.fn(async () => [
        { id: 'task_a', title: 'Follow up', dueAt: null, updatedAt, status: 'OPEN' as const },
      ]),
      fetchCrmOpenDeals: vi.fn(async () => [
        { id: 'deal_a', title: 'Deal A', updatedAt, status: 'OPEN' as const },
      ]),
      fetchPendingMergeProposals: vi.fn(async () => [{ id: 'merge_a', createdAt: updatedAt }]),
    })
    const overview = await getBusinessOverview(portal, data)
    const paths = new Map(overview.actions.map((a) => [a.recordRef.id, a.destination.path]))
    expect(paths.get('task_a')).toBe(BUSINESS_DESTINATIONS.crmTask('task_a'))
    expect(paths.get('deal_a')).toBe(BUSINESS_DESTINATIONS.crmDeal('deal_a'))
    expect(paths.get('merge_a')).toBe(BUSINESS_DESTINATIONS.crmMergeProposal('merge_a'))
  })
})
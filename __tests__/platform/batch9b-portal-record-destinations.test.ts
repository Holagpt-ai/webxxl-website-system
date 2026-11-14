import { beforeEach, describe, expect, it, vi } from 'vitest'
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
    reporting: { readiness: { state: 'unavailable', reasonCode: 'SKIP', message: 'skip' } },
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

describe('Batch 9B portal record destinations', () => {
  beforeEach(() => {
    process.env.CRM_BACKEND_ENABLED = 'true'
    process.env.MKT_BACKEND_ENABLED = 'true'
    process.env.SEO_BACKEND_ENABLED = 'true'
    process.env.COMMS_BACKEND_ENABLED = 'true'
  })

  it('encodes marketing review and project workflow destinations', () => {
    expect(BUSINESS_DESTINATIONS.marketingReview('rv_1')).toBe('/dashboard/marketing/approvals?reviewId=rv_1')
    expect(BUSINESS_DESTINATIONS.projectApproval('ap_1')).toBe('/dashboard/approvals?approvalId=ap_1')
    expect(BUSINESS_DESTINATIONS.projectDependency('dp_1')).toBe('/dashboard/project?dependencyId=dp_1')
  })

  it('emits record-scoped marketing and website project actions', async () => {
    const now = new Date('2026-10-31T00:00:00.000Z')
    const data = baseDataAccess({
      fetchMarketingReviews: vi.fn(async () => ({
        ok: true as const,
        value: {
          reviews: [
            {
              id: 'rv_a',
              effectiveStatus: 'SUBMITTED',
              revisionHash: 'abcdef01',
              expiresAt: null,
              createdAt: now,
            },
          ],
        },
      })) as unknown as BusinessOverviewDataAccess['fetchMarketingReviews'],
      fetchPendingProjectApprovals: vi.fn(async () => [
        { id: 'ap_a', title: 'Homepage', requestedAt: now, projectId: 'proj_1' },
      ]),
      fetchOpenProjectDependencies: vi.fn(async () => [
        {
          id: 'dep_a',
          title: 'Upload logo',
          dueDate: null,
          requestedFromCustomerAt: now,
          projectId: 'proj_1',
        },
      ]),
    })
    const overview = await getBusinessOverview(portal, data)
    const marketing = overview.actions.find((a) => a.actionType === 'marketing.review.pending')
    const approval = overview.actions.find((a) => a.actionType === 'website_projects.approval.pending')
    const dependency = overview.actions.find((a) => a.actionType === 'website_projects.dependency.open')
    expect(marketing?.destination.path).toBe(BUSINESS_DESTINATIONS.marketingReview('rv_a'))
    expect(approval?.destination.path).toBe(BUSINESS_DESTINATIONS.projectApproval('ap_a'))
    expect(dependency?.destination.path).toBe(BUSINESS_DESTINATIONS.projectDependency('dep_a'))
  })
})
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import type { PortalUser } from '@/lib/portal/authz'
import { emptySubscriberEvidence } from '@/lib/platform/open001/subscriber-evidence'
import { CUSTOMER_OPERATIONS_MAX_LINEAGE } from '@/lib/platform/customer-operations/constants'

vi.mock('@/lib/db', () => ({
  prisma: {
    managedSiteLead: { findMany: vi.fn() },
    project: { findFirst: vi.fn() },
    projectApproval: { count: vi.fn() },
    projectDependency: { count: vi.fn() },
    projectMilestone: { findFirst: vi.fn() },
    crmDeal: { count: vi.fn() },
    crmTask: { count: vi.fn() },
  },
}))

vi.mock('@/lib/platform/business-overview/service', () => ({
  getBusinessOverview: vi.fn(async () => ({
    customerAccountId: 'acct_a',
    generatedAt: '2026-11-07T00:00:00.000Z',
    accountScope: 'session_membership',
    modules: [],
    actions: [],
    limits: { maxActionsReturned: 20, maxActionsPerModule: 5 },
  })),
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

vi.mock('@/lib/platform/site-leads/summary-service', () => ({
  getManagedSiteLeadSummary: vi.fn(async () => ({
    ok: true,
    value: {
      summary: {
        leadsReceived: { value: 2, scope: 'account_total' },
        awaitingReview: { value: 1, scope: 'account_total' },
        qualified: { value: 0, scope: 'account_total' },
        converted: { value: 1, scope: 'account_total' },
        rejected: { value: 0, scope: 'account_total' },
        duplicateReview: { value: 0, scope: 'account_total' },
      },
    },
  })),
}))

function portalStub(): PortalUser {
  return {
    id: 'user_1',
    role: 'CUSTOMER',
    membership: { role: 'OWNER', customerAccountId: 'acct_a', userId: 'user_1' } as PortalUser['membership'],
    customerAccount: { id: 'acct_a', businessName: 'A Co' } as PortalUser['customerAccount'],
  } as PortalUser
}

describe('Batch 1 customer operations engine', () => {
  const env = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...env, CRM_BACKEND_ENABLED: 'true' }
  })

  afterEach(() => {
    process.env = env
    vi.clearAllMocks()
  })

  it('exposes GET /api/v1/customer-operations/summary with tenant scope', () => {
    const route = readFileSync(
      join(process.cwd(), 'app/api/v1/customer-operations/summary/route.ts'),
      'utf8',
    )
    expect(route).toContain('requireCustomerMembership')
    expect(route).toContain('getCustomerOperationsSummary')
    expect(route).toContain('customerAccountId')
    expect(route).toContain('FORBIDDEN')
  })

  it('documents the API contract for v0 integration', () => {
    const doc = readFileSync(
      join(process.cwd(), 'docs/platform/docs/BATCH1-CUSTOMER-OPERATIONS-API-CONTRACT.md'),
      'utf8',
    )
    expect(doc).toContain('/api/v1/customer-operations/summary')
    expect(doc).toContain('businessOverview')
    expect(doc).toContain('recentLineage')
  })

  it('composes business overview, lead pipeline, and lineage when CRM proceeds', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.managedSiteLead.findMany).mockResolvedValue([
      {
        id: 'lead_1',
        status: 'CONVERTED',
        managedSiteId: 'site_1',
        submittedAt: new Date('2026-11-01T12:00:00.000Z'),
        qualifiedAt: new Date('2026-11-02T12:00:00.000Z'),
        convertedAt: new Date('2026-11-03T12:00:00.000Z'),
        rejectedAt: null,
        crmContactId: 'contact_1',
        managedSite: { name: 'Main site', projectId: 'proj_1' },
      },
    ] as never)
    vi.mocked(prisma.crmDeal.count).mockResolvedValue(1)
    vi.mocked(prisma.crmTask.count).mockResolvedValue(2)
    vi.mocked(prisma.project.findFirst).mockResolvedValue({
      id: 'proj_1',
      name: 'Website build',
      progressPercent: 40,
      estimatedCompletionDate: new Date('2026-12-01T00:00:00.000Z'),
    } as never)
    vi.mocked(prisma.projectApproval.count).mockResolvedValue(1)
    vi.mocked(prisma.projectDependency.count).mockResolvedValue(0)
    vi.mocked(prisma.projectMilestone.findFirst).mockResolvedValue({ title: 'Design review' } as never)

    const { getCustomerOperationsSummary } = await import('@/lib/platform/customer-operations/service')
    const summary = await getCustomerOperationsSummary(portalStub())

    expect(summary.customerAccountId).toBe('acct_a')
    expect(summary.businessOverview.customerAccountId).toBe('acct_a')
    expect(summary.leadPipeline.readiness).toMatchObject({ state: 'available', evidenceCount: 2, empty: false })
    expect(summary.recentLineage).toHaveLength(1)
    expect(summary.recentLineage[0]?.crm?.openTasks).toBe(2)
    expect(summary.recentLineage[0]?.project?.nextMilestoneTitle).toBe('Design review')
    expect(prisma.managedSiteLead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: CUSTOMER_OPERATIONS_MAX_LINEAGE }),
    )
  })

  it('reports CRM disabled on lead pipeline without inventing counts', async () => {
    process.env.CRM_BACKEND_ENABLED = 'false'
    const { getCustomerOperationsSummary } = await import('@/lib/platform/customer-operations/service')
    const summary = await getCustomerOperationsSummary(portalStub())
    expect(summary.leadPipeline.readiness).toMatchObject({ state: 'disabled', reasonCode: 'CRM_DISABLED' })
    expect(summary.recentLineage).toEqual([])
    const { prisma } = await import('@/lib/db')
    expect(prisma.managedSiteLead.findMany).not.toHaveBeenCalled()
  })

  it('reports true zero-lead empty state without double-counting lifecycle buckets', async () => {
    const { getManagedSiteLeadSummary } = await import('@/lib/platform/site-leads/summary-service')
    vi.mocked(getManagedSiteLeadSummary).mockResolvedValueOnce({
      ok: true,
      value: {
        summary: {
          leadsReceived: { value: 0, scope: 'account_total' },
          awaitingReview: { value: 0, scope: 'account_total' },
          qualified: { value: 0, scope: 'account_total' },
          converted: { value: 0, scope: 'account_total' },
          rejected: { value: 0, scope: 'account_total' },
          duplicateReview: { value: 0, scope: 'account_total' },
        },
      },
    } as never)
    const { getCustomerOperationsSummary } = await import('@/lib/platform/customer-operations/service')
    const result = await getCustomerOperationsSummary(portalStub())
    expect(result.leadPipeline.readiness).toMatchObject({ state: 'available', empty: true, evidenceCount: 0 })
  })

  it('does not read lead lineage for account without CRM subscriber eligibility', async () => {
    const { loadSubscriberEvidenceForAccount } = await import('@/lib/platform/open001/load-subscriber-evidence')
    vi.mocked(loadSubscriberEvidenceForAccount).mockResolvedValueOnce({
      customerAccountId: 'acct_a',
      subscriptions: [],
      legacyWebsiteServices: [],
      loadOutcome: 'ok',
    } as never)
    const { prisma } = await import('@/lib/db')
    const { getCustomerOperationsSummary } = await import('@/lib/platform/customer-operations/service')
    const result = await getCustomerOperationsSummary(portalStub())
    expect(result.leadPipeline.readiness.state).not.toBe('available')
    expect(result.recentLineage).toEqual([])
    expect(prisma.managedSiteLead.findMany).not.toHaveBeenCalled()
  })

  it('subscriber evidence helper stays isolated per account in unit fixtures', () => {
    const evidenceA = emptySubscriberEvidence('acct_a')
    const evidenceB = emptySubscriberEvidence('acct_b')
    expect(evidenceA.customerAccountId).toBe('acct_a')
    expect(evidenceB.customerAccountId).toBe('acct_b')
  })
})

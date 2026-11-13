import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import {
  ADMIN_OPERATIONS_BATCH_VERSION,
  ADMIN_OPERATIONS_DISCLOSURE,
} from '@/lib/platform/admin-operations/constants'

vi.mock('@/lib/db', () => ({
  prisma: {
    customerAccount: { count: vi.fn(), findUnique: vi.fn() },
    customerMembership: { findFirst: vi.fn() },
    project: { count: vi.fn() },
    projectApproval: { count: vi.fn() },
    changeRequest: { count: vi.fn() },
    supportRequest: { count: vi.fn() },
    serviceOrder: { count: vi.fn() },
    managedSiteLead: { count: vi.fn() },
    projectTask: { count: vi.fn() },
  },
}))

vi.mock('@/lib/platform/comms-execution/service', () => ({
  getCommunicationsExecutionSummary: vi.fn(async () => ({ ok: true, value: { batchVersion: 'batch4' } })),
}))
vi.mock('@/lib/platform/commerce-execution/service', () => ({
  getCommerceExecutionSummary: vi.fn(async () => ({ ok: true, value: { batchVersion: 'batch5' } })),
}))
vi.mock('@/lib/platform/marketing-execution/service', () => ({
  getMarketingExecutionSummary: vi.fn(async () => ({ ok: true, value: { assembledAt: '2026-01-01' } })),
}))
vi.mock('@/lib/platform/ai-workforce-execution/summary', () => ({
  getAiWorkforceExecutionSummary: vi.fn(() => ({ version: 'batch6' })),
}))
vi.mock('@/lib/platform/admin-operations/staff-portal-context', () => ({
  buildStaffCompositionPortal: vi.fn(async () => ({
    id: 'staff-1',
    role: 'STAFF',
    membership: { role: 'MEMBER', customerAccountId: 'acct_a' },
    customerAccount: { id: 'acct_a', businessName: 'A Co', status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date() },
  })),
}))

describe('Batch 7 platform admin operations', () => {
  const env = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...env, WORKFLOW_WORKER_ENABLED: 'false' }
    vi.mocked(prisma.customerAccount.count).mockResolvedValue(3)
    vi.mocked(prisma.project.count).mockResolvedValue(5)
    vi.mocked(prisma.projectApproval.count).mockResolvedValue(2)
    vi.mocked(prisma.changeRequest.count).mockResolvedValue(1)
    vi.mocked(prisma.supportRequest.count).mockResolvedValue(4)
    vi.mocked(prisma.serviceOrder.count).mockResolvedValue(1)
    vi.mocked(prisma.managedSiteLead.count).mockResolvedValue(6)
    vi.mocked(prisma.projectTask.count).mockResolvedValue(2)
  })

  afterEach(() => {
    process.env = env
    vi.clearAllMocks()
  })

  it('exposes GET /api/v1/admin/operations/summary with staff auth', () => {
    const route = readFileSync(join(process.cwd(), 'app/api/v1/admin/operations/summary/route.ts'), 'utf8')
    expect(route).toContain('requireStaff')
    expect(route).toContain('getAdminOperationsSummary')
    expect(route).toContain('customerAccountId')
  })

  it('documents the API and v0 integration contracts', () => {
    const api = readFileSync(
      join(process.cwd(), 'docs/platform/docs/BATCH7-PLATFORM-ADMIN-OPERATIONS-API-CONTRACT.md'),
      'utf8',
    )
    const ui = readFileSync(join(process.cwd(), 'docs/platform/docs/BATCH7B-ADMIN-UI-INTEGRATION-CONTRACT.md'), 'utf8')
    expect(api).toContain('/api/v1/admin/operations/summary')
    expect(api).toContain('requireStaff')
    expect(ui).toContain('ai-workforce/execution/summary')
    expect(ui).toContain('DEFERRED_V0')
  })

  it('composes platform scope without account execution attachment', async () => {
    const { getAdminOperationsSummary } = await import('@/lib/platform/admin-operations/service')
    const summary = await getAdminOperationsSummary({
      staffUser: { id: 'staff-1', role: 'STAFF' } as never,
    })
    expect(summary.version).toBe(ADMIN_OPERATIONS_BATCH_VERSION)
    expect(summary.disclosure).toBe(ADMIN_OPERATIONS_DISCLOSURE)
    expect(summary.scope).toBe('platform')
    expect(summary.platformQueues.status).toBe('AVAILABLE')
    expect(summary.platformQueues.data?.websiteLeadsAwaitingReview).toBe(6)
    expect(summary.runtimeGates.data?.liveActivationBlocked).toBe(true)
    expect(summary.accountExecution.reasonCode).toBe('ACCOUNT_SCOPE_REQUIRED')
    expect(summary.publicConversion.data?.state).toBe('DEFERRED_V0')
  })

  it('attaches execution summaries when customerAccountId is set', async () => {
    const { getAdminOperationsSummary } = await import('@/lib/platform/admin-operations/service')
    const summary = await getAdminOperationsSummary({
      staffUser: { id: 'staff-1', role: 'STAFF' } as never,
      customerAccountId: 'acct_a',
    })
    expect(summary.scope).toBe('customer_account')
    expect(summary.accountExecution.status).toBe('AVAILABLE')
    expect(summary.accountExecution.data?.communications).toEqual({ batchVersion: 'batch4' })
    expect(summary.accountExecution.data?.aiWorkforce).toEqual({ version: 'batch6' })
  })
})

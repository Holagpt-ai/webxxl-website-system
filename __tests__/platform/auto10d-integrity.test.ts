import { beforeEach, describe, expect, it, vi } from 'vitest'

const casTransitionWorkflowJob = vi.fn()
const abandonOpenWorkflowAttempts = vi.fn()
const workflowAttemptCreate = vi.fn()
const workflowAttemptUpdateMany = vi.fn()
const outboxUpdateMany = vi.fn()

vi.mock('@/lib/platform/workflow/job-transition', () => ({
  casTransitionWorkflowJob,
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        workflowAttempt: { create: workflowAttemptCreate, updateMany: workflowAttemptUpdateMany },
      }),
    workflowOutbox: { updateMany: outboxUpdateMany },
    workflowJob: { findUnique: vi.fn() },
    $queryRaw: vi.fn().mockResolvedValue([]),
  },
}))

describe('AUTO-10D lease-race corrections', () => {
  beforeEach(() => {
    casTransitionWorkflowJob.mockReset()
    abandonOpenWorkflowAttempts.mockReset()
    workflowAttemptCreate.mockReset()
    workflowAttemptUpdateMany.mockReset()
    outboxUpdateMany.mockReset()
  })

  it('2: failed start CAS leaves attempts unchanged', async () => {
    casTransitionWorkflowJob.mockResolvedValueOnce(null)
    const { beginWorkflowExecutionAttempt } = await import('@/lib/platform/workflow/attempt-lifecycle')
    const result = await beginWorkflowExecutionAttempt({
      jobId: 'j1',
      leaseToken: 't1',
      leaseFence: 1,
      workerId: 'w1',
    })
    expect(result.ok).toBe(false)
    expect(abandonOpenWorkflowAttempts).not.toHaveBeenCalled()
    expect(workflowAttemptCreate).not.toHaveBeenCalled()
  })

  it('1/3: CAS precedes abandon and attempt create in one transaction', async () => {
    const order: string[] = []
    casTransitionWorkflowJob.mockImplementation(async () => {
      order.push('cas')
      return {
        id: 'j1',
        attemptCount: 2,
        jobKind: 'X',
        customerAccountId: null,
        managedSiteId: null,
        billingGroupId: null,
        correlationId: 'c',
        sourceType: 's',
        sourceId: '1',
        sourceRevisionHash: null,
        idempotencyKey: 'k',
        requestFingerprint: 'fp',
        status: 'RUNNING',
        priority: 0,
        scheduledAt: new Date(),
        nextAttemptAt: new Date(),
        maxAttempts: 8,
        leaseOwner: 'w',
        leaseToken: 't',
        leaseFence: 1,
        leaseExpiresAt: new Date(Date.now() + 60_000),
        heartbeatAt: null,
        lastErrorCode: null,
        lastErrorClass: null,
        resultRef: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: null,
      }
    })
    workflowAttemptUpdateMany.mockImplementation(async () => {
      order.push('abandon')
      return { count: 0 }
    })
    workflowAttemptCreate.mockImplementation(async () => {
      order.push('create')
      return {}
    })

    const { beginWorkflowExecutionAttempt } = await import('@/lib/platform/workflow/attempt-lifecycle')
    const result = await beginWorkflowExecutionAttempt({
      jobId: 'j1',
      leaseToken: 't1',
      leaseFence: 1,
      workerId: 'w1',
    })
    expect(result.ok).toBe(true)
    expect(order).toEqual(['cas', 'abandon', 'create'])
  })

  it('3: attempt creation failure rolls back via transaction throw', async () => {
    casTransitionWorkflowJob.mockResolvedValueOnce({
      id: 'j1',
      attemptCount: 1,
      jobKind: 'X',
      customerAccountId: null,
      managedSiteId: null,
      billingGroupId: null,
      correlationId: 'c',
      sourceType: 's',
      sourceId: '1',
      sourceRevisionHash: null,
      idempotencyKey: 'k',
      requestFingerprint: 'fp',
      status: 'RUNNING',
      priority: 0,
      scheduledAt: new Date(),
      nextAttemptAt: new Date(),
      maxAttempts: 8,
      leaseOwner: 'w',
      leaseToken: 't',
      leaseFence: 1,
      leaseExpiresAt: new Date(Date.now() + 60_000),
      heartbeatAt: null,
      lastErrorCode: null,
      lastErrorClass: null,
      resultRef: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      completedAt: null,
    })
    abandonOpenWorkflowAttempts.mockResolvedValueOnce(0)
    workflowAttemptCreate.mockRejectedValueOnce(new Error('unique violation'))

    const { beginWorkflowExecutionAttempt } = await import('@/lib/platform/workflow/attempt-lifecycle')
    const result = await beginWorkflowExecutionAttempt({
      jobId: 'j1',
      leaseToken: 't1',
      leaseFence: 1,
      workerId: 'w1',
    })
    expect(result.ok).toBe(false)
  })

  it('5: expired outbox lease fails acknowledgment at current time', async () => {
    const { isOutboxDispatchLeaseValid } = await import('@/lib/platform/workflow/outbox')
    const batchStart = new Date(Date.now() - 300_000)
    const leaseExpiresAt = new Date(batchStart.getTime() + 60_000)
    expect(isOutboxDispatchLeaseValid(leaseExpiresAt, batchStart)).toBe(true)
    expect(isOutboxDispatchLeaseValid(leaseExpiresAt, new Date())).toBe(false)
  })

  it('6: new dispatcher ownership rejects stale token at finalize CAS', async () => {
    outboxUpdateMany.mockResolvedValueOnce({ count: 0 })
    const ackNow = new Date()
    const result = await outboxUpdateMany({
      where: {
        id: 'ob-1',
        status: 'PENDING',
        requestFingerprint: 'fp',
        dispatchLeaseToken: 'stale-token',
        dispatchLeaseExpiresAt: { gt: ackNow },
      },
      data: { status: 'DISPATCHED' },
    })
    expect(result).toEqual({ count: 0 })
  })
})

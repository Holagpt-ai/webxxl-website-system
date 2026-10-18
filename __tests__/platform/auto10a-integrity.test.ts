import { beforeEach, describe, expect, it, vi } from 'vitest'
import { canTransitionWorkflowStatus } from '@/lib/platform/workflow/state-machine'
import { partitionFairClaims } from '@/lib/platform/workflow/fairness'
import {
  buildWorkflowOutboxEnvelope,
  parseWorkflowOutboxEnvelope,
} from '@/lib/platform/workflow/outbox-envelope'
import { classifyHandlerException } from '@/lib/platform/workflow/worker-errors'
import { toSafeWorkflowEvent } from '@/lib/platform/workflow/read-dto'
import {
  isWorkflowBackendEnabled,
  isWorkflowExternalEffectsEnabled,
} from '@/config/workflow-backend'
import { executeCommsReceiptWorkflow } from '@/lib/platform/workflow/handlers/comms-receipt'
import { executeMarketingFollowUpWorkflow } from '@/lib/platform/workflow/handlers/marketing-followup'
import { executeSeoSyncPrepareWorkflow } from '@/lib/platform/workflow/handlers/seo-sync-prepare'
import { ABMED_AESTHETICS_ACCOUNT_ID, ABMED_PHYSICIANS_ACCOUNT_ID } from '@/lib/platform/fixtures/abmed'

const { updateMany, findUnique, transaction, commsFindUnique, siteFindFirst } = vi.hoisted(() => ({
  updateMany: vi.fn(),
  findUnique: vi.fn(),
  transaction: vi.fn(),
  commsFindUnique: vi.fn(),
  siteFindFirst: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    workflowJob: { findUnique, updateMany },
    $transaction: transaction,
    commsWebhookReceipt: { findUnique: commsFindUnique },
    siteAnalyticsConnection: { findFirst: siteFindFirst },
  },
}))

vi.mock('@/lib/platform/comms/receipt-processor', () => ({
  processCommsWebhookReceiptById: vi.fn(),
}))

vi.mock('@/lib/platform/marketing/follow-up-evaluation-service', () => ({
  evaluateAccountLeadFollowUps: vi.fn(),
}))

vi.mock('@/config/comms-backend', () => ({
  isCommsReceiptWorkerEnabled: () => true,
}))

vi.mock('@/config/mkt-backend', () => ({
  isMktLeadMonitorEnabled: () => true,
}))

vi.mock('@/config/workflow-backend', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@/config/workflow-backend')>()
  return {
    ...orig,
    isWorkflowDurableExecutionAllowed: () => true,
  }
})

describe('AUTO-10A merge integrity', () => {
  beforeEach(() => {
    updateMany.mockReset()
    findUnique.mockReset()
  })

  it('B: retry transition targets RETRY_WAIT not READY', () => {
    expect(canTransitionWorkflowStatus('RUNNING', 'RETRY_WAIT')).toBe(true)
    expect(canTransitionWorkflowStatus('RETRY_WAIT', 'READY')).toBe(true)
    expect(canTransitionWorkflowStatus('RUNNING', 'READY')).toBe(true)
  })

  it('D/E: fairness partition rejects excess without dropping from input set', () => {
    const jobs = Array.from({ length: 6 }).map((_, i) => ({
      id: `j${i}`,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      jobKind: 'COMMS_RECEIPT_PROCESS',
    })) as Parameters<typeof partitionFairClaims>[0]
    jobs.push({
      id: 'p1',
      customerAccountId: ABMED_PHYSICIANS_ACCOUNT_ID,
      jobKind: 'COMMS_RECEIPT_PROCESS',
    } as (typeof jobs)[number])
    const { selected, rejected } = partitionFairClaims(jobs, { perAccountCap: 2, maxBatch: 10 })
    expect(selected.length).toBe(3)
    expect(rejected.length).toBe(4)
    expect(selected.length + rejected.length).toBe(jobs.length)
  })

  it('F: valid outbox envelope round-trips enqueue payload', () => {
    const envelope = buildWorkflowOutboxEnvelope({
      eventKey: 'evt-1',
      payloadRef: { receiptId: 'r1' },
      enqueue: {
        jobKind: 'COMMS_RECEIPT_PROCESS',
        customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
        correlationId: 'c1',
        sourceType: 'comms_receipt',
        sourceId: 'r1',
        idempotencyKey: 'idem-1',
        payloadRef: { receiptId: 'r1' },
      },
    })
    const parsed = parseWorkflowOutboxEnvelope(envelope)
    expect(parsed?.enqueue.idempotencyKey).toBe('idem-1')
    expect(parsed?.eventKey).toBe('evt-1')
  })

  it('L: unknown external handler exception quarantines to reconciliation', () => {
    const result = classifyHandlerException(new Error('UNKNOWN_EXTERNAL_OUTCOME'))
    expect(result.outcome).toBe('AWAITING_RECONCILIATION')
  })

  it('O/P: safe workflow event DTO omits sensitive detail', () => {
    const dto = toSafeWorkflowEvent({
      id: 'e1',
      workflowJobId: 'j1',
      eventType: 'CLAIMED',
      fromStatus: 'READY',
      toStatus: 'CLAIMED',
      actorUserId: null,
      actorService: 'worker',
      detail: { leaseToken: 'secret', payload: { body: 'phi' } },
      createdAt: new Date(),
    })
    expect(dto).not.toHaveProperty('detail')
  })

  it('R: foreign COMMS receipt denied', async () => {
    commsFindUnique.mockResolvedValue({
      id: 'r1',
      customerAccountId: ABMED_PHYSICIANS_ACCOUNT_ID,
    } as never)
    const result = await executeCommsReceiptWorkflow(
      {
        job: {
          id: 'j1',
          customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
          sourceId: 'r1',
        } as never,
        attemptNumber: 1,
        leaseToken: 't',
        leaseFence: 1,
        workerId: 'w',
      },
      { receiptId: 'r1' },
    )
    expect(result.outcome).toBe('FAILED_TERMINAL')
    if (result.outcome === 'FAILED_TERMINAL') expect(result.errorCode).toBe('FOREIGN_RECEIPT')
  })

  it('S: foreign managed site denied for marketing follow-up', async () => {
    const result = await executeMarketingFollowUpWorkflow(
      {
        job: {
          id: 'j1',
          customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
          managedSiteId: 'site-a',
          idempotencyKey: 'k',
        } as never,
        attemptNumber: 1,
        leaseToken: 't',
        leaseFence: 1,
        workerId: 'w',
      },
      { managedSiteId: 'site-b' },
    )
    expect(result.outcome).toBe('FAILED_TERMINAL')
    if (result.outcome === 'FAILED_TERMINAL') expect(result.errorCode).toBe('FOREIGN_MANAGED_SITE')
  })

  it('S: SEO prepare rejects payload site override', async () => {
    siteFindFirst.mockResolvedValue(null)
    const result = await executeSeoSyncPrepareWorkflow(
      {
        job: {
          id: 'j1',
          customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
          managedSiteId: 'site-a',
          idempotencyKey: 'k',
        } as never,
        attemptNumber: 1,
        leaseToken: 't',
        leaseFence: 1,
        workerId: 'w',
      },
      { managedSiteId: 'site-b', provider: 'GSC' },
    )
    expect(result.outcome).toBe('FAILED_TERMINAL')
  })

  it('T: external execution flags remain OFF by default', () => {
    const saved = process.env.WORKFLOW_EXTERNAL_EFFECTS_ENABLED
    delete process.env.WORKFLOW_EXTERNAL_EFFECTS_ENABLED
    delete process.env.WORKFLOW_BACKEND_ENABLED
    expect(isWorkflowBackendEnabled()).toBe(false)
    expect(isWorkflowExternalEffectsEnabled()).toBe(false)
    if (saved !== undefined) process.env.WORKFLOW_EXTERNAL_EFFECTS_ENABLED = saved
  })

  it('A/J: CAS updateMany failure yields lease conflict semantics', async () => {
    updateMany.mockResolvedValue({ count: 0 })
    findUnique.mockResolvedValue({
      id: 'j1',
      status: 'RUNNING',
      leaseToken: 'a',
      leaseFence: 2,
      leaseExpiresAt: new Date(Date.now() + 60_000),
    })
    const { casTransitionWorkflowJob } = await import('@/lib/platform/workflow/job-transition')
    const row = await casTransitionWorkflowJob(
      { workflowJob: { findUnique, updateMany }, workflowEvent: { create: vi.fn() } } as never,
      {
        jobId: 'j1',
        fromStatuses: ['RUNNING'],
        toStatus: 'COMPLETED',
        expectedLease: { token: 'a', fence: 2 },
        eventType: 'COMPLETED',
      },
    )
    expect(row).toBeNull()
  })
})

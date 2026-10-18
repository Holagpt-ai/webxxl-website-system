import { prisma } from '@/lib/db'
import {
  WORKFLOW_CLAIM_BATCH_DEFAULT,
  isWorkflowDurableExecutionAllowed,
  isWorkflowWorkerEnabled,
} from '@/config/workflow-backend'
import { applyPerAccountClaimFairness } from '@/lib/platform/workflow/fairness'
import { getWorkflowHandler } from '@/lib/platform/workflow/handlers/registry'
import { prismaWorkflowProvider } from '@/lib/platform/workflow/prisma-provider'
import { computeWorkflowBackoffMs, isRetryableWorkflowError } from '@/lib/platform/workflow/retry-policy'
import { dispatchPendingOutbox } from '@/lib/platform/workflow/outbox'
import { recoverAbandonedJobs } from '@/lib/platform/workflow/recovery'
import { recordWorkflowEvent } from '@/lib/platform/workflow/workflow-events'
import type { HandlerExecutionResult } from '@/lib/platform/workflow/types'

export type WorkflowWorkerRunResult = {
  outboxDispatched: number
  recovered: number
  claimed: number
  completed: number
  retried: number
  failed: number
  blocked: number
  awaitingReconciliation: number
}

async function persistPayloadForJob(jobId: string): Promise<Record<string, unknown>> {
  const event = await prisma.workflowEvent.findFirst({
    where: { workflowJobId: jobId, eventType: 'ENQUEUED' },
    orderBy: { createdAt: 'desc' },
  })
  const detail = event?.detail as Record<string, unknown> | null
  const payloadRef = detail?.payloadRef
  return payloadRef && typeof payloadRef === 'object' ? (payloadRef as Record<string, unknown>) : {}
}

async function applyHandlerResult(
  jobId: string,
  leaseToken: string,
  leaseFence: number,
  attemptCount: number,
  maxAttempts: number,
  result: HandlerExecutionResult,
): Promise<'completed' | 'retried' | 'failed' | 'blocked' | 'reconcile'> {
  switch (result.outcome) {
    case 'COMPLETED':
      await prismaWorkflowProvider.complete({ jobId, leaseToken, leaseFence, resultRef: result.resultRef })
      return 'completed'
    case 'BLOCKED':
      await prisma.workflowJob.updateMany({
        where: { id: jobId, leaseToken, leaseFence },
        data: { status: 'BLOCKED', lastErrorCode: result.errorCode },
      })
      return 'blocked'
    case 'AWAITING_RECONCILIATION':
      await prisma.workflowJob.updateMany({
        where: { id: jobId, leaseToken, leaseFence },
        data: {
          status: 'AWAITING_RECONCILIATION',
          lastErrorCode: result.errorCode,
          resultRef: result.resultRef ?? null,
        },
      })
      return 'reconcile'
    case 'FAILED_TERMINAL':
      await prismaWorkflowProvider.fail({
        jobId,
        leaseToken,
        leaseFence,
        errorCode: result.errorCode,
        errorClass: result.errorClass,
        terminal: true,
      })
      return 'failed'
    case 'RETRY':
      if (!isRetryableWorkflowError(result.errorClass) || attemptCount + 1 >= maxAttempts) {
        await prismaWorkflowProvider.fail({
          jobId,
          leaseToken,
          leaseFence,
          errorCode: result.errorCode,
          errorClass: result.errorClass,
          terminal: false,
        })
        return 'failed'
      }
      await prismaWorkflowProvider.retry({
        jobId,
        leaseToken,
        leaseFence,
        errorCode: result.errorCode,
        errorClass: result.errorClass,
        nextAttemptAt: new Date(Date.now() + computeWorkflowBackoffMs(attemptCount + 1, result.retryAfterMs)),
      })
      return 'retried'
  }
}

export async function runWorkflowWorkerBatch(input?: {
  workerId?: string
  limit?: number
}): Promise<WorkflowWorkerRunResult> {
  const result: WorkflowWorkerRunResult = {
    outboxDispatched: 0,
    recovered: 0,
    claimed: 0,
    completed: 0,
    retried: 0,
    failed: 0,
    blocked: 0,
    awaitingReconciliation: 0,
  }
  if (!isWorkflowDurableExecutionAllowed() || !isWorkflowWorkerEnabled()) {
    return result
  }

  const workerId = input?.workerId ?? `workflow-worker:${process.env.HOSTNAME ?? 'local'}`
  result.outboxDispatched = await dispatchPendingOutbox(25)
  result.recovered = await recoverAbandonedJobs()

  const claimed = applyPerAccountClaimFairness(
    await prismaWorkflowProvider.claim({ workerId, limit: input?.limit ?? WORKFLOW_CLAIM_BATCH_DEFAULT }),
  )
  result.claimed = claimed.length

  for (const job of claimed) {
    if (!job.leaseToken) continue
    await prisma.workflowJob.updateMany({
      where: { id: job.id, leaseToken: job.leaseToken, leaseFence: job.leaseFence },
      data: { status: 'RUNNING' },
    })
    await recordWorkflowEvent(prisma, {
      workflowJobId: job.id,
      eventType: 'STARTED',
      toStatus: 'RUNNING',
      actorService: workerId,
    })

    const handler = getWorkflowHandler(job.jobKind)
    if (!handler) {
      await prismaWorkflowProvider.fail({
        jobId: job.id,
        leaseToken: job.leaseToken,
        leaseFence: job.leaseFence,
        errorCode: 'UNKNOWN_JOB_KIND',
        errorClass: 'PERMANENT',
        terminal: true,
      })
      result.failed += 1
      continue
    }

    const payload = await persistPayloadForJob(job.id)
    const handlerResult = await handler(
      {
        job,
        attemptNumber: job.attemptCount + 1,
        leaseToken: job.leaseToken,
        leaseFence: job.leaseFence,
        workerId,
      },
      payload,
    )

    const outcome = await applyHandlerResult(
      job.id,
      job.leaseToken,
      job.leaseFence,
      job.attemptCount,
      job.maxAttempts,
      handlerResult,
    )
    if (outcome === 'completed') result.completed += 1
    if (outcome === 'retried') result.retried += 1
    if (outcome === 'failed') result.failed += 1
    if (outcome === 'blocked') result.blocked += 1
    if (outcome === 'reconcile') result.awaitingReconciliation += 1
  }

  return result
}

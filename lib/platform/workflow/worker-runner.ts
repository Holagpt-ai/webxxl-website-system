import { prisma } from '@/lib/db'
import {
  WORKFLOW_CLAIM_BATCH_DEFAULT,
  WORKFLOW_LEASE_TTL_MS,
  isWorkflowDurableExecutionAllowed,
  isWorkflowWorkerEnabled,
} from '@/config/workflow-backend'
import { beginWorkflowExecutionAttempt } from '@/lib/platform/workflow/attempt-lifecycle'
import { getWorkflowHandler } from '@/lib/platform/workflow/handlers/registry'
import { prismaWorkflowProvider } from '@/lib/platform/workflow/prisma-provider'
import { computeWorkflowBackoffMs, isRetryableWorkflowError } from '@/lib/platform/workflow/retry-policy'
import { dispatchPendingOutbox } from '@/lib/platform/workflow/outbox'
import { recoverAbandonedJobs } from '@/lib/platform/workflow/recovery'
import type { HandlerExecutionResult } from '@/lib/platform/workflow/types'
import { classifyHandlerException } from '@/lib/platform/workflow/worker-errors'

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

async function finishWorkflowAttempt(input: {
  workflowJobId: string
  attemptNumber: number
  status: string
  errorCode?: string
  errorClass?: string
  resultRef?: string
}) {
  await prisma.workflowAttempt.updateMany({
    where: { workflowJobId: input.workflowJobId, attemptNumber: input.attemptNumber },
    data: {
      status:
        input.status === 'COMPLETED'
          ? 'COMPLETED'
          : input.status === 'RETRY'
            ? 'RETRY_WAIT'
            : input.status === 'AWAITING_RECONCILIATION'
              ? 'AWAITING_RECONCILIATION'
              : input.status === 'BLOCKED'
                ? 'BLOCKED'
                : 'FAILED_TERMINAL',
      finishedAt: new Date(),
      errorCode: input.errorCode ?? null,
      errorClass: input.errorClass as never,
      resultRef: input.resultRef ?? null,
    },
  })
}

async function applyHandlerResult(
  jobId: string,
  leaseToken: string,
  leaseFence: number,
  attemptNumber: number,
  attemptCount: number,
  maxAttempts: number,
  result: HandlerExecutionResult,
): Promise<'completed' | 'retried' | 'failed' | 'blocked' | 'reconcile' | 'lease_conflict'> {
  switch (result.outcome) {
    case 'COMPLETED': {
      const res = await prismaWorkflowProvider.complete({ jobId, leaseToken, leaseFence, resultRef: result.resultRef })
      if (!res.ok) return 'lease_conflict'
      await finishWorkflowAttempt({
        workflowJobId: jobId,
        attemptNumber,
        status: 'COMPLETED',
        resultRef: result.resultRef,
      })
      return 'completed'
    }
    case 'BLOCKED': {
      const res = await prismaWorkflowProvider.markBlocked({
        jobId,
        leaseToken,
        leaseFence,
        errorCode: result.errorCode,
      })
      if (!res.ok) return 'lease_conflict'
      await finishWorkflowAttempt({
        workflowJobId: jobId,
        attemptNumber,
        status: 'BLOCKED',
        errorCode: result.errorCode,
      })
      return 'blocked'
    }
    case 'AWAITING_RECONCILIATION': {
      const res = await prismaWorkflowProvider.markAwaitingReconciliation({
        jobId,
        leaseToken,
        leaseFence,
        errorCode: result.errorCode,
        resultRef: result.resultRef,
      })
      if (!res.ok) return 'lease_conflict'
      await finishWorkflowAttempt({
        workflowJobId: jobId,
        attemptNumber,
        status: 'AWAITING_RECONCILIATION',
        errorCode: result.errorCode,
        resultRef: result.resultRef,
      })
      return 'reconcile'
    }
    case 'FAILED_TERMINAL': {
      const res = await prismaWorkflowProvider.fail({
        jobId,
        leaseToken,
        leaseFence,
        errorCode: result.errorCode,
        errorClass: result.errorClass,
        terminal: true,
      })
      if (!res.ok) return 'lease_conflict'
      await finishWorkflowAttempt({
        workflowJobId: jobId,
        attemptNumber,
        status: 'FAILED_TERMINAL',
        errorCode: result.errorCode,
        errorClass: result.errorClass,
      })
      return 'failed'
    }
    case 'RETRY':
      if (!isRetryableWorkflowError(result.errorClass) || attemptCount >= maxAttempts) {
        const res = await prismaWorkflowProvider.fail({
          jobId,
          leaseToken,
          leaseFence,
          errorCode: result.errorCode,
          errorClass: result.errorClass,
          terminal: false,
        })
        if (!res.ok) return 'lease_conflict'
        await finishWorkflowAttempt({
          workflowJobId: jobId,
          attemptNumber,
          status: 'FAILED_TERMINAL',
          errorCode: result.errorCode,
          errorClass: result.errorClass,
        })
        return 'failed'
      }
      {
        const res = await prismaWorkflowProvider.retry({
          jobId,
          leaseToken,
          leaseFence,
          errorCode: result.errorCode,
          errorClass: result.errorClass,
          nextAttemptAt: new Date(Date.now() + computeWorkflowBackoffMs(attemptCount, result.retryAfterMs)),
        })
        if (!res.ok) return 'lease_conflict'
        await finishWorkflowAttempt({
          workflowJobId: jobId,
          attemptNumber,
          status: 'RETRY',
          errorCode: result.errorCode,
          errorClass: result.errorClass,
        })
        return 'retried'
      }
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

  const claimed = await prismaWorkflowProvider.claim({
    workerId,
    limit: input?.limit ?? WORKFLOW_CLAIM_BATCH_DEFAULT,
  })
  result.claimed = claimed.length

  for (const job of claimed) {
    if (!job.leaseToken) continue

    const begun = await beginWorkflowExecutionAttempt({
      jobId: job.id,
      leaseToken: job.leaseToken,
      leaseFence: job.leaseFence,
      workerId,
    })
    if (!begun.ok) continue

    const runningJob = begun.value.job
    const attemptNumber = begun.value.attemptNumber

    const handler = getWorkflowHandler(runningJob.jobKind)
    if (!handler) {
      const outcome = await applyHandlerResult(
        runningJob.id,
        job.leaseToken,
        job.leaseFence,
        attemptNumber,
        runningJob.attemptCount,
        runningJob.maxAttempts,
        { outcome: 'FAILED_TERMINAL', errorClass: 'PERMANENT', errorCode: 'UNKNOWN_JOB_KIND' },
      )
      if (outcome === 'failed') result.failed += 1
      continue
    }

    let handlerResult: HandlerExecutionResult
    try {
      await prismaWorkflowProvider.heartbeat({
        jobId: runningJob.id,
        leaseToken: job.leaseToken,
        leaseFence: job.leaseFence,
        leaseTtlMs: WORKFLOW_LEASE_TTL_MS,
      })
      const payload = await persistPayloadForJob(runningJob.id)
      handlerResult = await handler(
        {
          job: runningJob,
          attemptNumber,
          leaseToken: job.leaseToken,
          leaseFence: job.leaseFence,
          workerId,
        },
        payload,
      )
    } catch (error) {
      handlerResult = classifyHandlerException(error)
    }

    const outcome = await applyHandlerResult(
      runningJob.id,
      job.leaseToken,
      job.leaseFence,
      attemptNumber,
      runningJob.attemptCount,
      runningJob.maxAttempts,
      handlerResult,
    )
    if (outcome === 'completed') result.completed += 1
    else if (outcome === 'retried') result.retried += 1
    else if (outcome === 'failed') result.failed += 1
    else if (outcome === 'blocked') result.blocked += 1
    else if (outcome === 'reconcile') result.awaitingReconciliation += 1
  }

  return result
}

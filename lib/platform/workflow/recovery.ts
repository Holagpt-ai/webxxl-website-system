import type { Prisma, WorkflowJobStatus } from '@prisma/client'
import { prisma } from '@/lib/db'
import { isWorkflowDurableExecutionAllowed, isWorkflowRepairEnabled } from '@/config/workflow-backend'
import { casTransitionWorkflowJobTx } from '@/lib/platform/workflow/job-transition'
import { prismaWorkflowProvider } from '@/lib/platform/workflow/prisma-provider'
import { computeWorkflowBackoffMs } from '@/lib/platform/workflow/retry-policy'

export async function detectExpiredLeases(now = new Date()): Promise<number> {
  return prisma.workflowJob.count({
    where: {
      status: { in: ['CLAIMED', 'RUNNING'] },
      leaseExpiresAt: { lt: now },
    },
  })
}

function recoveryTargetStatus(job: {
  lastErrorClass: string | null
  attemptCount: number
  maxAttempts: number
}): WorkflowJobStatus {
  if (job.lastErrorClass === 'UNKNOWN_EXTERNAL_OUTCOME') {
    return 'AWAITING_RECONCILIATION'
  }
  if (job.attemptCount >= job.maxAttempts) {
    return 'DEAD_LETTER'
  }
  return 'RETRY_WAIT'
}

/** Automatic worker recovery for expired leases — does not require WORKFLOW_REPAIR_ENABLED. */
export async function recoverAbandonedJobs(now = new Date()): Promise<number> {
  if (!isWorkflowDurableExecutionAllowed()) return 0

  const rows = await prisma.workflowJob.findMany({
    where: {
      status: { in: ['CLAIMED', 'RUNNING'] },
      leaseExpiresAt: { lt: now },
    },
    take: 50,
  })

  let recovered = 0
  for (const job of rows) {
    const toStatus = recoveryTargetStatus(job)
    const nextAttemptAt =
      toStatus === 'RETRY_WAIT'
        ? new Date(now.getTime() + computeWorkflowBackoffMs(job.attemptCount + 1))
        : job.nextAttemptAt

    const row = await casTransitionWorkflowJobTx({
      jobId: job.id,
      fromStatuses: ['CLAIMED', 'RUNNING'],
      toStatus,
      expectedLease: job.leaseToken ? { token: job.leaseToken, fence: job.leaseFence } : null,
      requireExpiredLease: true,
      now,
      data: {
        leaseOwner: null,
        leaseToken: null,
        leaseExpiresAt: null,
        leaseFence: { increment: 1 },
        nextAttemptAt,
        lastErrorCode: job.lastErrorCode ?? 'LEASE_EXPIRED',
      },
      eventType: 'RECOVERED',
      eventDetail: { reason: 'expired_lease', previousStatus: job.status },
    })
    if (row) {
      recovered += 1
      if (toStatus === 'DEAD_LETTER') {
        await prisma.workflowDeadLetter.create({
          data: {
            workflowJobId: job.id,
            reason: job.lastErrorCode ?? 'LEASE_EXPIRED_MAX_ATTEMPTS',
            errorClass: job.lastErrorClass ?? undefined,
          },
        })
      }
    }
  }
  return recovered
}

export async function listStuckJobs(limit = 50) {
  return prisma.workflowJob.findMany({
    where: {
      status: { in: ['BLOCKED', 'AWAITING_RECONCILIATION', 'RETRY_WAIT'] },
    },
    orderBy: { updatedAt: 'asc' },
    take: limit,
  })
}

export async function recordRepairDecision(input: {
  workflowJobId: string
  decision: string
  actorUserId: string
  correlationId: string
  detail?: Record<string, unknown>
}) {
  if (!isWorkflowRepairEnabled()) {
    throw new Error('WORKFLOW_REPAIR_DISABLED')
  }
  await prisma.workflowRepairAudit.create({
    data: {
      workflowJobId: input.workflowJobId,
      decision: input.decision,
      actorUserId: input.actorUserId,
      correlationId: input.correlationId,
      detail: input.detail as Prisma.InputJsonValue | undefined,
    },
  })
}

export async function prepareRepair(jobId: string) {
  if (!isWorkflowRepairEnabled()) {
    throw new Error('WORKFLOW_REPAIR_DISABLED')
  }
  const job = await prismaWorkflowProvider.getStatus(jobId)
  if (!job) return null
  const attempts = await prisma.workflowAttempt.findMany({
    where: { workflowJobId: jobId },
    orderBy: { attemptNumber: 'desc' },
    take: 10,
  })
  const events = await prisma.workflowEvent.findMany({
    where: { workflowJobId: jobId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })
  return { job, attempts, events }
}

export async function classifyDeadLetters(limit = 50, customerAccountId?: string) {
  if (customerAccountId) {
    return prisma.workflowDeadLetter.findMany({
      where: { workflowJob: { customerAccountId } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
  }
  return prisma.workflowDeadLetter.findMany({ orderBy: { createdAt: 'desc' }, take: limit })
}

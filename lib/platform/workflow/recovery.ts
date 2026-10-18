import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { isWorkflowRepairEnabled } from '@/config/workflow-backend'
import { prismaWorkflowProvider } from '@/lib/platform/workflow/prisma-provider'
import { recordWorkflowEvent } from '@/lib/platform/workflow/workflow-events'

export async function detectExpiredLeases(now = new Date()): Promise<number> {
  const expired = await prisma.workflowJob.findMany({
    where: {
      status: { in: ['CLAIMED', 'RUNNING'] },
      leaseExpiresAt: { lt: now },
    },
    take: 100,
  })
  return expired.length
}

export async function recoverAbandonedJobs(now = new Date()): Promise<number> {
  if (!isWorkflowRepairEnabled()) return 0
  const rows = await prisma.workflowJob.findMany({
    where: {
      status: { in: ['CLAIMED', 'RUNNING'] },
      leaseExpiresAt: { lt: now },
    },
    take: 50,
  })
  let recovered = 0
  for (const job of rows) {
    const updated = await prisma.workflowJob.updateMany({
      where: {
        id: job.id,
        leaseFence: job.leaseFence,
        status: { in: ['CLAIMED', 'RUNNING'] },
      },
      data: {
        status: 'READY',
        leaseOwner: null,
        leaseToken: null,
        leaseExpiresAt: null,
        nextAttemptAt: now,
      },
    })
    if (updated.count === 1) {
      recovered += 1
      await recordWorkflowEvent(prisma, {
        workflowJobId: job.id,
        eventType: 'RECOVERED',
        fromStatus: job.status,
        toStatus: 'READY',
      })
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

export async function classifyDeadLetters(limit = 50) {
  return prisma.workflowDeadLetter.findMany({ orderBy: { createdAt: 'desc' }, take: limit })
}

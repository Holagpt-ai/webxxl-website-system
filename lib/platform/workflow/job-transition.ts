import type { Prisma, WorkflowJob, WorkflowJobStatus } from '@prisma/client'
import type { PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/db'
import { assertWorkflowTransition } from '@/lib/platform/workflow/state-machine'
import { recordWorkflowEvent } from '@/lib/platform/workflow/workflow-events'

type Db = PrismaClient | Prisma.TransactionClient

export type CasJobTransitionInput = {
  jobId: string
  fromStatuses: WorkflowJobStatus[]
  toStatus: WorkflowJobStatus
  expectedLease?: { token: string; fence: number } | null
  requireUnexpiredLease?: boolean
  requireExpiredLease?: boolean
  now?: Date
  data?: Prisma.WorkflowJobUpdateManyMutationInput
  eventType: string
  eventDetail?: Record<string, unknown>
  actorService?: string | null
}

export async function casTransitionWorkflowJob(
  db: Db,
  input: CasJobTransitionInput,
): Promise<WorkflowJob | null> {
  const now = input.now ?? new Date()
  const current = await db.workflowJob.findUnique({ where: { id: input.jobId } })
  if (!current) return null
  if (!input.fromStatuses.includes(current.status)) return null
  assertWorkflowTransition(current.status, input.toStatus)

  if (input.expectedLease) {
    if (current.leaseToken !== input.expectedLease.token || current.leaseFence !== input.expectedLease.fence) {
      return null
    }
  }
  if (input.requireUnexpiredLease) {
    if (!current.leaseExpiresAt || current.leaseExpiresAt <= now) return null
  }

  const where: Prisma.WorkflowJobWhereInput = {
    id: input.jobId,
    status: current.status,
  }
  if (input.expectedLease) {
    where.leaseToken = input.expectedLease.token
    where.leaseFence = input.expectedLease.fence
  }
  if (input.requireUnexpiredLease) {
    where.leaseExpiresAt = { gt: now }
  }
  if (input.requireExpiredLease) {
    where.leaseExpiresAt = { lt: now }
  }

  const updated = await db.workflowJob.updateMany({
    where,
    data: { ...input.data, status: input.toStatus, updatedAt: now },
  })
  if (updated.count !== 1) return null

  const row = await db.workflowJob.findUnique({ where: { id: input.jobId } })
  if (!row) return null

  await recordWorkflowEvent(db, {
    workflowJobId: input.jobId,
    eventType: input.eventType,
    fromStatus: current.status,
    toStatus: input.toStatus,
    actorService: input.actorService ?? undefined,
    detail: input.eventDetail,
  })
  return row
}

/** Run CAS transition in a single transaction (job row + event). */
export async function casTransitionWorkflowJobTx(input: CasJobTransitionInput): Promise<WorkflowJob | null> {
  return prisma.$transaction(async (tx) => casTransitionWorkflowJob(tx, input))
}

import type { Prisma, WorkflowJob } from '@prisma/client'
import type { PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/db'
import { casTransitionWorkflowJob } from '@/lib/platform/workflow/job-transition'
import { mapWorkflowJob } from '@/lib/platform/workflow/job-mapper'
import type { WorkflowJobSnapshot, WorkflowResult } from '@/lib/platform/workflow/types'

type Db = PrismaClient | Prisma.TransactionClient

/** Finalize in-flight attempts (crash recovery) before starting or recovering the next one. */
export async function abandonOpenWorkflowAttempts(
  db: Db,
  input: {
    workflowJobId: string
    leaseToken?: string | null
    leaseFence?: number | null
    reason: string
    /** Never abandon attempts owned by this active worker lease. */
    protectLease?: { token: string; fence: number }
  },
): Promise<number> {
  const where: Prisma.WorkflowAttemptWhereInput = {
    workflowJobId: input.workflowJobId,
    finishedAt: null,
    status: 'RUNNING',
  }
  if (input.leaseToken != null) {
    where.leaseToken = input.leaseToken
  }
  if (input.leaseFence != null) {
    where.leaseFence = input.leaseFence
  }
  if (input.protectLease) {
    where.NOT = {
      AND: [{ leaseToken: input.protectLease.token }, { leaseFence: input.protectLease.fence }],
    }
  }

  const updated = await db.workflowAttempt.updateMany({
    where,
    data: {
      status: 'FAILED_TERMINAL',
      finishedAt: new Date(),
      errorCode: input.reason,
    },
  })
  return updated.count
}

/** Atomically enter RUNNING, bump attemptCount, and create a unique WorkflowAttempt row. */
export async function beginWorkflowExecutionAttempt(input: {
  jobId: string
  leaseToken: string
  leaseFence: number
  workerId: string
}): Promise<WorkflowResult<{ job: WorkflowJobSnapshot; attemptNumber: number }>> {
  try {
    const result = await prisma.$transaction(async (tx) => {
      await abandonOpenWorkflowAttempts(tx, {
        workflowJobId: input.jobId,
        reason: 'ATTEMPT_SUPERSEDED',
        protectLease: { token: input.leaseToken, fence: input.leaseFence },
      })

      const running = await casTransitionWorkflowJob(tx, {
        jobId: input.jobId,
        fromStatuses: ['CLAIMED'],
        toStatus: 'RUNNING',
        expectedLease: { token: input.leaseToken, fence: input.leaseFence },
        requireUnexpiredLease: true,
        data: {
          attemptCount: { increment: 1 },
        },
        eventType: 'STARTED',
        actorService: input.workerId,
      })
      if (!running) return null

      const attemptNumber = running.attemptCount
      await tx.workflowAttempt.create({
        data: {
          workflowJobId: input.jobId,
          attemptNumber,
          leaseOwner: input.workerId,
          leaseToken: input.leaseToken,
          leaseFence: input.leaseFence,
          status: 'RUNNING',
        },
      })

      return { job: mapWorkflowJob(running), attemptNumber }
    })

    if (!result) return { ok: false, error: 'LEASE_CONFLICT' }
    return { ok: true, value: result }
  } catch {
    return { ok: false, error: 'LEASE_CONFLICT' }
  }
}

export function attemptsExhausted(job: Pick<WorkflowJob, 'attemptCount' | 'maxAttempts'>): boolean {
  return job.attemptCount >= job.maxAttempts
}

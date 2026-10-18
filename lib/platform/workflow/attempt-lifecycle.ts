import type { WorkflowJob } from '@prisma/client'
import { prisma } from '@/lib/db'
import { casTransitionWorkflowJob } from '@/lib/platform/workflow/job-transition'
import { mapWorkflowJob } from '@/lib/platform/workflow/job-mapper'
import type { WorkflowJobSnapshot, WorkflowResult } from '@/lib/platform/workflow/types'

function isP2002(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === 'P2002'
}

/** Finalize in-flight attempts (crash recovery) before starting or recovering the next one. */
export async function abandonOpenWorkflowAttempts(input: {
  workflowJobId: string
  leaseToken?: string | null
  leaseFence?: number | null
  reason: string
}): Promise<number> {
  const where: {
    workflowJobId: string
    finishedAt: null
    status: 'RUNNING'
    leaseToken?: string
    leaseFence?: number
  } = {
    workflowJobId: input.workflowJobId,
    finishedAt: null,
    status: 'RUNNING',
  }
  if (input.leaseToken) where.leaseToken = input.leaseToken
  if (input.leaseFence != null) where.leaseFence = input.leaseFence

  const updated = await prisma.workflowAttempt.updateMany({
    where,
    data: {
      status: 'FAILED_TERMINAL',
      finishedAt: new Date(),
      errorCode: input.reason,
    },
  })
  return updated.count
}

export async function rollbackRunningWithoutAttempt(input: {
  jobId: string
  leaseToken: string
  leaseFence: number
}): Promise<void> {
  await casTransitionWorkflowJob(prisma, {
    jobId: input.jobId,
    fromStatuses: ['RUNNING'],
    toStatus: 'READY',
    expectedLease: { token: input.leaseToken, fence: input.leaseFence },
    requireUnexpiredLease: true,
    data: {
      leaseOwner: null,
      leaseToken: null,
      leaseExpiresAt: null,
    },
    eventType: 'ATTEMPT_ROLLBACK',
    eventDetail: { reason: 'attempt_record_failed' },
  })
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
      await abandonOpenWorkflowAttempts({
        workflowJobId: input.jobId,
        reason: 'ATTEMPT_SUPERSEDED',
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
      try {
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
      } catch (error) {
        if (!isP2002(error)) throw error
        const existing = await tx.workflowAttempt.findUnique({
          where: {
            workflowJobId_attemptNumber: {
              workflowJobId: input.jobId,
              attemptNumber,
            },
          },
        })
        if (!existing || existing.status !== 'RUNNING' || existing.finishedAt != null) {
          throw error
        }
      }

      return { job: mapWorkflowJob(running), attemptNumber }
    })

    if (!result) return { ok: false, error: 'LEASE_CONFLICT' }
    return { ok: true, value: result }
  } catch {
    await rollbackRunningWithoutAttempt(input)
    return { ok: false, error: 'LEASE_CONFLICT' }
  }
}

export function attemptsExhausted(job: Pick<WorkflowJob, 'attemptCount' | 'maxAttempts'>): boolean {
  return job.attemptCount >= job.maxAttempts
}

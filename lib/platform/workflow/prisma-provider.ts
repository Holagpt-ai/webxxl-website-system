import type { WorkflowJob, WorkflowJobStatus } from '@prisma/client'
import { prisma } from '@/lib/db'
import {
  WORKFLOW_LEASE_TTL_MS,
  validatedWorkflowClaimBatchLimit,
} from '@/config/workflow-backend'
import { computeClaimHeadroom, partitionFairClaims } from '@/lib/platform/workflow/fairness'
import { buildEnqueueFingerprint } from '@/lib/platform/workflow/fingerprint'
import { casTransitionWorkflowJobTx } from '@/lib/platform/workflow/job-transition'
import { mapWorkflowJob } from '@/lib/platform/workflow/job-mapper'
import type {
  ClaimBatchInput,
  CompleteJobInput,
  FailJobInput,
  RetryJobInput,
  WorkflowProvider,
} from '@/lib/platform/workflow/provider'
import { assertWorkflowTransition } from '@/lib/platform/workflow/state-machine'
import type { EnqueueWorkflowJobInput, WorkflowJobSnapshot, WorkflowResult } from '@/lib/platform/workflow/types'
import { recordWorkflowEvent } from '@/lib/platform/workflow/workflow-events'

function isP2002(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === 'P2002'
}

async function releaseClaimedJob(job: WorkflowJobSnapshot, now: Date): Promise<void> {
  if (!job.leaseToken) return
  const toStatus: WorkflowJobStatus = job.nextAttemptAt > now ? 'RETRY_WAIT' : 'READY'
  await casTransitionWorkflowJobTx({
    jobId: job.id,
    fromStatuses: ['CLAIMED'],
    toStatus,
    expectedLease: { token: job.leaseToken, fence: job.leaseFence },
    now,
    data: {
      leaseOwner: null,
      leaseToken: null,
      leaseExpiresAt: null,
    },
    eventType: 'CLAIM_RELEASED',
    eventDetail: { reason: 'fairness_or_admission' },
  })
}

export class PrismaWorkflowProvider implements WorkflowProvider {
  async enqueue(input: EnqueueWorkflowJobInput): Promise<WorkflowResult<WorkflowJobSnapshot>> {
    const fingerprint = buildEnqueueFingerprint(input)
    try {
      const created = await prisma.$transaction(async (tx) => {
        const job = await tx.workflowJob.create({
          data: {
            jobKind: input.jobKind,
            customerAccountId: input.customerAccountId ?? null,
            managedSiteId: input.managedSiteId ?? null,
            billingGroupId: input.billingGroupId ?? null,
            correlationId: input.correlationId,
            sourceType: input.sourceType,
            sourceId: input.sourceId,
            sourceRevisionHash: input.sourceRevisionHash ?? null,
            idempotencyKey: input.idempotencyKey,
            requestFingerprint: fingerprint,
            status: 'READY',
            priority: input.priority ?? 0,
            scheduledAt: input.scheduledAt ?? new Date(),
            nextAttemptAt: input.scheduledAt ?? new Date(),
            maxAttempts: input.maxAttempts ?? 8,
          },
        })
        await recordWorkflowEvent(tx, {
          workflowJobId: job.id,
          eventType: 'ENQUEUED',
          toStatus: 'READY',
          detail: { payloadRef: input.payloadRef },
        })
        return job
      })
      return { ok: true, value: mapWorkflowJob(created) }
    } catch (error) {
      if (!isP2002(error)) throw error
      const existing = await prisma.workflowJob.findUnique({ where: { idempotencyKey: input.idempotencyKey } })
      if (!existing) throw error
      if (existing.requestFingerprint !== fingerprint) {
        return { ok: false, error: 'IDEMPOTENCY_CONFLICT', message: 'Idempotency key reused with different payload' }
      }
      if (
        input.customerAccountId &&
        existing.customerAccountId &&
        existing.customerAccountId !== input.customerAccountId
      ) {
        return { ok: false, error: 'IDEMPOTENCY_CONFLICT', message: 'Cross-tenant idempotency conflict' }
      }
      return { ok: true, value: mapWorkflowJob(existing) }
    }
  }

  async claim(input: ClaimBatchInput): Promise<WorkflowJobSnapshot[]> {
    const now = input.now ?? new Date()
    const leaseTtlMs = input.leaseTtlMs ?? WORKFLOW_LEASE_TTL_MS
    const leaseExpires = new Date(now.getTime() + leaseTtlMs)
    const workerId = input.workerId

    const globalActive = await prisma.workflowJob.count({
      where: { status: { in: ['CLAIMED', 'RUNNING'] } },
    })
    const headroom = computeClaimHeadroom(globalActive)
    const batchLimit = Math.min(validatedWorkflowClaimBatchLimit(input.limit), headroom)
    if (batchLimit < 1) return []

    const rows = await prisma.$queryRaw<WorkflowJob[]>`
      WITH candidates AS (
        SELECT j.id
        FROM "WorkflowJob" j
        WHERE j.status IN ('READY'::"WorkflowJobStatus", 'RETRY_WAIT'::"WorkflowJobStatus")
          AND j."nextAttemptAt" <= ${now}
          AND (j."leaseExpiresAt" IS NULL OR j."leaseExpiresAt" < ${now})
        ORDER BY j.priority DESC, j."scheduledAt" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT ${batchLimit}
      )
      UPDATE "WorkflowJob" j
      SET
        status = 'CLAIMED'::"WorkflowJobStatus",
        "leaseOwner" = ${workerId},
        "leaseToken" = gen_random_uuid()::text,
        "leaseExpiresAt" = ${leaseExpires},
        "leaseFence" = j."leaseFence" + 1,
        "updatedAt" = ${now}
      FROM candidates c
      WHERE j.id = c.id
      RETURNING j.*
    `

    const snapshots = rows.map(mapWorkflowJob)
    const { selected, rejected } = partitionFairClaims(snapshots, { maxBatch: batchLimit })

    for (const job of rejected) {
      await releaseClaimedJob(job, now)
    }

    for (const row of rows.filter((r) => selected.some((s) => s.id === r.id))) {
      await recordWorkflowEvent(prisma, {
        workflowJobId: row.id,
        eventType: 'CLAIMED',
        fromStatus: 'READY',
        toStatus: 'CLAIMED',
        actorService: workerId,
      })
    }

    return selected
  }

  async startRunning(input: {
    jobId: string
    leaseToken: string
    leaseFence: number
    workerId: string
  }): Promise<WorkflowResult<WorkflowJobSnapshot>> {
    const row = await casTransitionWorkflowJobTx({
      jobId: input.jobId,
      fromStatuses: ['CLAIMED'],
      toStatus: 'RUNNING',
      expectedLease: { token: input.leaseToken, fence: input.leaseFence },
      requireUnexpiredLease: true,
      data: {},
      eventType: 'STARTED',
      actorService: input.workerId,
    })
    if (!row) return { ok: false, error: 'LEASE_CONFLICT' }
    return { ok: true, value: mapWorkflowJob(row) }
  }

  async heartbeat(input: {
    jobId: string
    leaseToken: string
    leaseFence: number
    leaseTtlMs?: number
  }): Promise<WorkflowResult<void>> {
    const now = new Date()
    const leaseExpires = new Date(now.getTime() + (input.leaseTtlMs ?? WORKFLOW_LEASE_TTL_MS))
    const updated = await prisma.workflowJob.updateMany({
      where: {
        id: input.jobId,
        leaseToken: input.leaseToken,
        leaseFence: input.leaseFence,
        status: { in: ['CLAIMED', 'RUNNING'] },
        leaseExpiresAt: { gt: now },
      },
      data: { heartbeatAt: now, leaseExpiresAt: leaseExpires, updatedAt: now },
    })
    if (updated.count !== 1) return { ok: false, error: 'LEASE_CONFLICT' }
    await recordWorkflowEvent(prisma, {
      workflowJobId: input.jobId,
      eventType: 'LEASE_RENEWED',
    })
    return { ok: true, value: undefined }
  }

  async complete(input: CompleteJobInput): Promise<WorkflowResult<WorkflowJobSnapshot>> {
    const row = await casTransitionWorkflowJobTx({
      jobId: input.jobId,
      fromStatuses: ['RUNNING', 'CLAIMED'],
      toStatus: 'COMPLETED',
      expectedLease: { token: input.leaseToken, fence: input.leaseFence },
      data: {
        resultRef: input.resultRef ?? null,
        completedAt: new Date(),
        leaseOwner: null,
        leaseToken: null,
        leaseExpiresAt: null,
      },
      eventType: 'COMPLETED',
    })
    if (!row) return { ok: false, error: 'LEASE_CONFLICT' }
    return { ok: true, value: mapWorkflowJob(row) }
  }

  async fail(input: FailJobInput): Promise<WorkflowResult<WorkflowJobSnapshot>> {
    const toStatus = input.terminal ? 'FAILED_TERMINAL' : 'DEAD_LETTER'
    const row = await casTransitionWorkflowJobTx({
      jobId: input.jobId,
      fromStatuses: ['RUNNING', 'CLAIMED', 'RETRY_WAIT', 'AWAITING_RECONCILIATION'],
      toStatus,
      expectedLease: { token: input.leaseToken, fence: input.leaseFence },
      data: {
        lastErrorCode: input.errorCode,
        lastErrorClass: input.errorClass,
        leaseOwner: null,
        leaseToken: null,
        leaseExpiresAt: null,
        completedAt: new Date(),
      },
      eventType: toStatus === 'DEAD_LETTER' ? 'DEAD_LETTERED' : 'FAILED',
    })
    if (!row) return { ok: false, error: 'LEASE_CONFLICT' }
    if (toStatus === 'DEAD_LETTER') {
      await prisma.workflowDeadLetter.create({
        data: {
          workflowJobId: input.jobId,
          reason: input.errorCode,
          errorClass: input.errorClass,
        },
      })
    }
    return { ok: true, value: mapWorkflowJob(row) }
  }

  async retry(input: RetryJobInput): Promise<WorkflowResult<WorkflowJobSnapshot>> {
    const row = await casTransitionWorkflowJobTx({
      jobId: input.jobId,
      fromStatuses: ['RUNNING', 'CLAIMED'],
      toStatus: 'RETRY_WAIT',
      expectedLease: { token: input.leaseToken, fence: input.leaseFence },
      data: {
        attemptCount: { increment: 1 },
        nextAttemptAt: input.nextAttemptAt,
        lastErrorCode: input.errorCode,
        lastErrorClass: input.errorClass,
        leaseOwner: null,
        leaseToken: null,
        leaseExpiresAt: null,
      },
      eventType: 'RETRIED',
      eventDetail: { nextAttemptAt: input.nextAttemptAt.toISOString() },
    })
    if (!row) return { ok: false, error: 'LEASE_CONFLICT' }
    return { ok: true, value: mapWorkflowJob(row) }
  }

  async markBlocked(input: {
    jobId: string
    leaseToken: string
    leaseFence: number
    errorCode: string
  }): Promise<WorkflowResult<WorkflowJobSnapshot>> {
    const row = await casTransitionWorkflowJobTx({
      jobId: input.jobId,
      fromStatuses: ['RUNNING', 'CLAIMED'],
      toStatus: 'BLOCKED',
      expectedLease: { token: input.leaseToken, fence: input.leaseFence },
      data: {
        lastErrorCode: input.errorCode,
        leaseOwner: null,
        leaseToken: null,
        leaseExpiresAt: null,
      },
      eventType: 'BLOCKED',
    })
    if (!row) return { ok: false, error: 'LEASE_CONFLICT' }
    return { ok: true, value: mapWorkflowJob(row) }
  }

  async markAwaitingReconciliation(input: {
    jobId: string
    leaseToken: string
    leaseFence: number
    errorCode: string
    resultRef?: string
  }): Promise<WorkflowResult<WorkflowJobSnapshot>> {
    const row = await casTransitionWorkflowJobTx({
      jobId: input.jobId,
      fromStatuses: ['RUNNING', 'CLAIMED'],
      toStatus: 'AWAITING_RECONCILIATION',
      expectedLease: { token: input.leaseToken, fence: input.leaseFence },
      data: {
        lastErrorCode: input.errorCode,
        resultRef: input.resultRef ?? null,
        leaseOwner: null,
        leaseToken: null,
        leaseExpiresAt: null,
      },
      eventType: 'AWAITING_RECONCILIATION',
    })
    if (!row) return { ok: false, error: 'LEASE_CONFLICT' }
    return { ok: true, value: mapWorkflowJob(row) }
  }

  async cancel(input: { jobId: string; reason: string }): Promise<WorkflowResult<WorkflowJobSnapshot>> {
    const current = await prisma.workflowJob.findUnique({ where: { id: input.jobId } })
    if (!current) return { ok: false, error: 'JOB_NOT_FOUND' }
    if (current.status === 'CANCELLED') return { ok: true, value: mapWorkflowJob(current) }
    assertWorkflowTransition(current.status, 'CANCELLED')
    const row = await casTransitionWorkflowJobTx({
      jobId: input.jobId,
      fromStatuses: [current.status],
      toStatus: 'CANCELLED',
      data: {
        lastErrorCode: input.reason,
        completedAt: new Date(),
        leaseOwner: null,
        leaseToken: null,
        leaseExpiresAt: null,
      },
      eventType: 'CANCELLED',
    })
    if (!row) return { ok: false, error: 'FORBIDDEN_TRANSITION' }
    return { ok: true, value: mapWorkflowJob(row) }
  }

  async pause(input: { jobId: string; reason: string }): Promise<WorkflowResult<WorkflowJobSnapshot>> {
    const current = await prisma.workflowJob.findUnique({ where: { id: input.jobId } })
    if (!current) return { ok: false, error: 'JOB_NOT_FOUND' }
    assertWorkflowTransition(current.status, 'PAUSED')
    const row = await casTransitionWorkflowJobTx({
      jobId: input.jobId,
      fromStatuses: [current.status],
      toStatus: 'PAUSED',
      data: { lastErrorCode: input.reason },
      eventType: 'PAUSED',
    })
    if (!row) return { ok: false, error: 'FORBIDDEN_TRANSITION' }
    return { ok: true, value: mapWorkflowJob(row) }
  }

  async resume(input: { jobId: string }): Promise<WorkflowResult<WorkflowJobSnapshot>> {
    const current = await prisma.workflowJob.findUnique({ where: { id: input.jobId } })
    if (!current) return { ok: false, error: 'JOB_NOT_FOUND' }
    assertWorkflowTransition(current.status, 'READY')
    const row = await casTransitionWorkflowJobTx({
      jobId: input.jobId,
      fromStatuses: [current.status],
      toStatus: 'READY',
      data: { nextAttemptAt: new Date() },
      eventType: 'RESUMED',
    })
    if (!row) return { ok: false, error: 'FORBIDDEN_TRANSITION' }
    return { ok: true, value: mapWorkflowJob(row) }
  }

  async reconcile(input: {
    jobId: string
    decision: 'COMPLETE' | 'DEAD_LETTER'
    resultRef?: string
  }): Promise<WorkflowResult<WorkflowJobSnapshot>> {
    const current = await prisma.workflowJob.findUnique({ where: { id: input.jobId } })
    if (!current) return { ok: false, error: 'JOB_NOT_FOUND' }
    const toStatus = input.decision === 'COMPLETE' ? 'COMPLETED' : 'DEAD_LETTER'
    assertWorkflowTransition(current.status, toStatus)
    const row = await casTransitionWorkflowJobTx({
      jobId: input.jobId,
      fromStatuses: [current.status],
      toStatus,
      data: {
        resultRef: input.resultRef ?? null,
        completedAt: new Date(),
      },
      eventType: 'RECONCILED',
    })
    if (!row) return { ok: false, error: 'FORBIDDEN_TRANSITION' }
    return { ok: true, value: mapWorkflowJob(row) }
  }

  async getStatus(jobId: string): Promise<WorkflowJobSnapshot | null> {
    const row = await prisma.workflowJob.findUnique({ where: { id: jobId } })
    return row ? mapWorkflowJob(row) : null
  }
}

export const prismaWorkflowProvider = new PrismaWorkflowProvider()

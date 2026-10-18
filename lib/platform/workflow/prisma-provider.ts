import type { WorkflowJob } from '@prisma/client'
import { prisma } from '@/lib/db'
import { WORKFLOW_LEASE_TTL_MS } from '@/config/workflow-backend'
import { buildEnqueueFingerprint } from '@/lib/platform/workflow/fingerprint'
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

async function transitionJob(
  jobId: string,
  expected: { leaseToken?: string | null; leaseFence?: number },
  toStatus: WorkflowJob['status'],
  data: Partial<WorkflowJob>,
): Promise<WorkflowJob | null> {
  const current = await prisma.workflowJob.findUnique({ where: { id: jobId } })
  if (!current) return null
  if (expected.leaseToken != null && current.leaseToken !== expected.leaseToken) return null
  if (expected.leaseFence != null && current.leaseFence !== expected.leaseFence) return null
  assertWorkflowTransition(current.status, toStatus)
  const updated = await prisma.workflowJob.update({
    where: { id: jobId },
    data: { ...data, status: toStatus, updatedAt: new Date() },
  })
  await recordWorkflowEvent(prisma, {
    workflowJobId: jobId,
    eventType: 'STATUS_CHANGED',
    fromStatus: current.status,
    toStatus,
  })
  return updated
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

    const rows = await prisma.$queryRaw<WorkflowJob[]>`
      WITH candidates AS (
        SELECT j.id
        FROM "WorkflowJob" j
        WHERE j.status IN ('READY'::"WorkflowJobStatus", 'RETRY_WAIT'::"WorkflowJobStatus")
          AND j."nextAttemptAt" <= ${now}
          AND (j."leaseExpiresAt" IS NULL OR j."leaseExpiresAt" < ${now})
        ORDER BY j.priority DESC, j."scheduledAt" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT ${input.limit}
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

    for (const row of rows) {
      await recordWorkflowEvent(prisma, {
        workflowJobId: row.id,
        eventType: 'CLAIMED',
        fromStatus: 'READY',
        toStatus: 'CLAIMED',
        actorService: workerId,
        detail: { leaseToken: row.leaseToken, leaseFence: row.leaseFence },
      })
    }
    return rows.map(mapWorkflowJob)
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
    const row = await transitionJob(
      input.jobId,
      { leaseToken: input.leaseToken, leaseFence: input.leaseFence },
      'COMPLETED',
      {
        resultRef: input.resultRef ?? null,
        completedAt: new Date(),
        leaseOwner: null,
        leaseToken: null,
        leaseExpiresAt: null,
      },
    )
    if (!row) return { ok: false, error: 'LEASE_CONFLICT' }
    await recordWorkflowEvent(prisma, { workflowJobId: input.jobId, eventType: 'COMPLETED', toStatus: 'COMPLETED' })
    return { ok: true, value: mapWorkflowJob(row) }
  }

  async fail(input: FailJobInput): Promise<WorkflowResult<WorkflowJobSnapshot>> {
    const toStatus = input.terminal ? 'FAILED_TERMINAL' : 'DEAD_LETTER'
    const row = await transitionJob(
      input.jobId,
      { leaseToken: input.leaseToken, leaseFence: input.leaseFence },
      toStatus,
      {
        lastErrorCode: input.errorCode,
        lastErrorClass: input.errorClass,
        leaseOwner: null,
        leaseToken: null,
        leaseExpiresAt: null,
        completedAt: new Date(),
      },
    )
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
    const current = await prisma.workflowJob.findUnique({ where: { id: input.jobId } })
    if (!current) return { ok: false, error: 'JOB_NOT_FOUND' }
    if (current.leaseToken !== input.leaseToken || current.leaseFence !== input.leaseFence) {
      return { ok: false, error: 'LEASE_CONFLICT' }
    }
    assertWorkflowTransition(current.status, 'RETRY_WAIT')
    const updated = await prisma.workflowJob.update({
      where: { id: input.jobId },
      data: {
        status: 'READY',
        attemptCount: current.attemptCount + 1,
        nextAttemptAt: input.nextAttemptAt,
        lastErrorCode: input.errorCode,
        lastErrorClass: input.errorClass,
        leaseOwner: null,
        leaseToken: null,
        leaseExpiresAt: null,
      },
    })
    await recordWorkflowEvent(prisma, {
      workflowJobId: input.jobId,
      eventType: 'RETRIED',
      fromStatus: current.status,
      toStatus: 'READY',
      detail: { nextAttemptAt: input.nextAttemptAt.toISOString() },
    })
    return { ok: true, value: mapWorkflowJob(updated) }
  }

  async cancel(input: { jobId: string; reason: string }): Promise<WorkflowResult<WorkflowJobSnapshot>> {
    const current = await prisma.workflowJob.findUnique({ where: { id: input.jobId } })
    if (!current) return { ok: false, error: 'JOB_NOT_FOUND' }
    const row = await transitionJob(input.jobId, {}, 'CANCELLED', {
      lastErrorCode: input.reason,
      completedAt: new Date(),
    })
    if (!row) return { ok: false, error: 'FORBIDDEN_TRANSITION' }
    return { ok: true, value: mapWorkflowJob(row) }
  }

  async pause(input: { jobId: string; reason: string }): Promise<WorkflowResult<WorkflowJobSnapshot>> {
    const row = await transitionJob(input.jobId, {}, 'PAUSED', { lastErrorCode: input.reason })
    if (!row) return { ok: false, error: 'FORBIDDEN_TRANSITION' }
    return { ok: true, value: mapWorkflowJob(row) }
  }

  async resume(input: { jobId: string }): Promise<WorkflowResult<WorkflowJobSnapshot>> {
    const row = await transitionJob(input.jobId, {}, 'READY', { nextAttemptAt: new Date() })
    if (!row) return { ok: false, error: 'FORBIDDEN_TRANSITION' }
    return { ok: true, value: mapWorkflowJob(row) }
  }

  async reconcile(input: {
    jobId: string
    decision: 'COMPLETE' | 'DEAD_LETTER'
    resultRef?: string
  }): Promise<WorkflowResult<WorkflowJobSnapshot>> {
    const toStatus = input.decision === 'COMPLETE' ? 'COMPLETED' : 'DEAD_LETTER'
    const row = await transitionJob(input.jobId, {}, toStatus, {
      resultRef: input.resultRef ?? null,
      completedAt: new Date(),
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

import type { Prisma, WorkflowOutbox } from '@prisma/client'
import { randomUUID } from 'crypto'
import { prisma } from '@/lib/db'
import { WORKFLOW_OUTBOX_DISPATCH_LEASE_MS } from '@/config/workflow-backend'
import {
  buildWorkflowOutboxEnvelope,
  parseWorkflowOutboxEnvelope,
  validateOutboxEnvelopeForRow,
  workflowJobMatchesOutboxEnvelope,
} from '@/lib/platform/workflow/outbox-envelope'
import { prismaWorkflowProvider } from '@/lib/platform/workflow/prisma-provider'
import type { EnqueueWorkflowJobInput } from '@/lib/platform/workflow/types'

type Db = typeof prisma | Prisma.TransactionClient

function dispatchWorkerId(): string {
  return `outbox-dispatcher:${process.env.HOSTNAME ?? 'local'}`
}

export async function appendWorkflowOutbox(
  db: Db,
  input: {
    eventKey: string
    customerAccountId?: string | null
    jobKind: string
    payloadRef: Record<string, unknown>
    enqueue: EnqueueWorkflowJobInput
  },
): Promise<void> {
  const envelope = buildWorkflowOutboxEnvelope({
    eventKey: input.eventKey,
    payloadRef: input.payloadRef,
    enqueue: input.enqueue,
  })
  if (envelope.eventKey !== input.eventKey) {
    throw new Error('OUTBOX_EVENT_KEY_MISMATCH')
  }
  await db.workflowOutbox.create({
    data: {
      eventKey: input.eventKey,
      customerAccountId: input.customerAccountId ?? input.enqueue.customerAccountId ?? null,
      jobKind: input.jobKind,
      payloadRef: envelope as unknown as Prisma.InputJsonValue,
      requestFingerprint: envelope.requestFingerprint,
      status: 'PENDING',
    },
  })
}

export async function reclaimExpiredOutboxDispatchLeases(now = new Date()): Promise<number> {
  const cleared = await prisma.workflowOutbox.updateMany({
    where: {
      status: 'PENDING',
      dispatchLeaseToken: { not: null },
      dispatchLeaseExpiresAt: { lt: now },
    },
    data: {
      dispatchLeaseToken: null,
      dispatchLeaseOwner: null,
      dispatchLeaseExpiresAt: null,
    },
  })
  return cleared.count
}

async function claimOutboxDispatchLease(outboxId: string, now = new Date()): Promise<string | null> {
  const leaseToken = randomUUID()
  const leaseExpiresAt = new Date(now.getTime() + WORKFLOW_OUTBOX_DISPATCH_LEASE_MS)
  const updated = await prisma.workflowOutbox.updateMany({
    where: {
      id: outboxId,
      status: 'PENDING',
      OR: [{ dispatchLeaseToken: null }, { dispatchLeaseExpiresAt: { lt: now } }],
    },
    data: {
      dispatchLeaseToken: leaseToken,
      dispatchLeaseOwner: dispatchWorkerId(),
      dispatchLeaseExpiresAt: leaseExpiresAt,
      dispatchAttemptCount: { increment: 1 },
    },
  })
  return updated.count === 1 ? leaseToken : null
}

async function releaseOutboxDispatchLease(outboxId: string, leaseToken: string): Promise<void> {
  await prisma.workflowOutbox.updateMany({
    where: {
      id: outboxId,
      status: 'PENDING',
      dispatchLeaseToken: leaseToken,
    },
    data: {
      dispatchLeaseToken: null,
      dispatchLeaseOwner: null,
      dispatchLeaseExpiresAt: null,
    },
  })
}

async function finalizeOutboxDispatch(
  outboxId: string,
  workflowJobId: string,
  expectedFingerprint: string,
  leaseToken: string,
  now = new Date(),
): Promise<boolean> {
  const updated = await prisma.workflowOutbox.updateMany({
    where: {
      id: outboxId,
      status: 'PENDING',
      requestFingerprint: expectedFingerprint,
      dispatchLeaseToken: leaseToken,
      dispatchLeaseExpiresAt: { gt: now },
    },
    data: {
      status: 'DISPATCHED',
      workflowJobId,
      dispatchedAt: now,
      lastError: null,
      dispatchLeaseToken: null,
      dispatchLeaseOwner: null,
      dispatchLeaseExpiresAt: null,
    },
  })
  return updated.count === 1
}

async function failOutboxRow(outboxId: string, reason: string, leaseToken?: string): Promise<void> {
  await prisma.workflowOutbox.updateMany({
    where: leaseToken
      ? { id: outboxId, status: 'PENDING', dispatchLeaseToken: leaseToken }
      : { id: outboxId, status: 'PENDING' },
    data: {
      status: 'FAILED',
      lastError: reason,
      dispatchLeaseToken: null,
      dispatchLeaseOwner: null,
      dispatchLeaseExpiresAt: null,
    },
  })
}

async function tryAcknowledgeExistingJob(
  row: WorkflowOutbox,
  envelope: NonNullable<ReturnType<typeof parseWorkflowOutboxEnvelope>>,
  leaseToken: string,
  now: Date,
): Promise<'dispatched' | 'failed' | 'continue'> {
  const jobId = row.workflowJobId
  const existingJob = jobId
    ? await prisma.workflowJob.findUnique({ where: { id: jobId } })
    : await prisma.workflowJob.findUnique({ where: { idempotencyKey: envelope.enqueue.idempotencyKey } })

  if (!existingJob) return 'continue'
  if (!workflowJobMatchesOutboxEnvelope(existingJob, envelope)) {
    await failOutboxRow(row.id, 'OUTBOX_REPLAY_CONFLICT', leaseToken)
    return 'failed'
  }
  const ok = await finalizeOutboxDispatch(row.id, existingJob.id, row.requestFingerprint, leaseToken, now)
  return ok ? 'dispatched' : 'failed'
}

async function dispatchOutboxRow(row: WorkflowOutbox, now = new Date()): Promise<'dispatched' | 'failed' | 'skipped'> {
  if (row.status === 'DISPATCHED' && row.workflowJobId) return 'skipped'

  const leaseToken = await claimOutboxDispatchLease(row.id, now)
  if (!leaseToken) return 'skipped'

  try {
    const envelope = parseWorkflowOutboxEnvelope(row.payloadRef)
    if (!envelope) {
      await failOutboxRow(row.id, 'Invalid outbox envelope', leaseToken)
      return 'failed'
    }

    const valid = validateOutboxEnvelopeForRow(row, envelope)
    if (!valid.ok) {
      await failOutboxRow(row.id, valid.reason, leaseToken)
      return 'failed'
    }

    const ack = await tryAcknowledgeExistingJob(row, envelope, leaseToken, now)
    if (ack === 'dispatched' || ack === 'failed') return ack

    const result = await prismaWorkflowProvider.enqueue(envelope.enqueue)
    if (!result.ok) {
      if (result.error === 'IDEMPOTENCY_CONFLICT') {
        const replay = await prisma.workflowJob.findUnique({
          where: { idempotencyKey: envelope.enqueue.idempotencyKey },
        })
        if (replay && workflowJobMatchesOutboxEnvelope(replay, envelope)) {
          const ok = await finalizeOutboxDispatch(row.id, replay.id, row.requestFingerprint, leaseToken, now)
          return ok ? 'dispatched' : 'failed'
        }
        await failOutboxRow(row.id, 'OUTBOX_REPLAY_CONFLICT', leaseToken)
        return 'failed'
      }
      await releaseOutboxDispatchLease(row.id, leaseToken)
      return 'failed'
    }

    if (
      !workflowJobMatchesOutboxEnvelope(
        {
          idempotencyKey: result.value.idempotencyKey,
          requestFingerprint: result.value.requestFingerprint,
          customerAccountId: result.value.customerAccountId,
          jobKind: result.value.jobKind,
          sourceType: result.value.sourceType,
          sourceId: result.value.sourceId,
        },
        envelope,
      )
    ) {
      await failOutboxRow(row.id, 'ENQUEUE_FINGERPRINT_CONFLICT', leaseToken)
      return 'failed'
    }

    const ok = await finalizeOutboxDispatch(row.id, result.value.id, row.requestFingerprint, leaseToken, now)
    return ok ? 'dispatched' : 'skipped'
  } catch {
    await releaseOutboxDispatchLease(row.id, leaseToken)
    return 'failed'
  }
}

export async function dispatchPendingOutbox(limit = 25): Promise<number> {
  const now = new Date()
  await reclaimExpiredOutboxDispatchLeases(now)

  const rows = await prisma.$queryRaw<WorkflowOutbox[]>`
    WITH picked AS (
      SELECT o.id
      FROM "WorkflowOutbox" o
      WHERE o.status = 'PENDING'::"WorkflowOutboxStatus"
      ORDER BY o."createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${limit}
    )
    SELECT o.*
    FROM "WorkflowOutbox" o
    INNER JOIN picked p ON p.id = o.id
  `

  let dispatched = 0
  for (const row of rows) {
    const outcome = await dispatchOutboxRow(row, now)
    if (outcome === 'dispatched') dispatched += 1
  }
  return dispatched
}

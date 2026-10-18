import type { Prisma, WorkflowOutbox } from '@prisma/client'
import { randomUUID } from 'crypto'
import { prisma } from '@/lib/db'
import {
  buildWorkflowOutboxEnvelope,
  parseWorkflowOutboxEnvelope,
  validateOutboxEnvelopeForRow,
  workflowJobMatchesOutboxEnvelope,
} from '@/lib/platform/workflow/outbox-envelope'
import { prismaWorkflowProvider } from '@/lib/platform/workflow/prisma-provider'
import type { EnqueueWorkflowJobInput } from '@/lib/platform/workflow/types'

type Db = typeof prisma | Prisma.TransactionClient

const DISPATCH_LEASE_PREFIX = 'dispatch-lease:'

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

async function claimOutboxDispatchLease(outboxId: string): Promise<string | null> {
  const leaseToken = randomUUID()
  const updated = await prisma.workflowOutbox.updateMany({
    where: {
      id: outboxId,
      status: 'PENDING',
      OR: [{ lastError: null }, { AND: [{ lastError: { not: null } }, { NOT: { lastError: { startsWith: DISPATCH_LEASE_PREFIX } } }] }],
    },
    data: { lastError: `${DISPATCH_LEASE_PREFIX}${leaseToken}` },
  })
  return updated.count === 1 ? leaseToken : null
}

async function releaseOutboxDispatchLease(outboxId: string, leaseToken: string): Promise<void> {
  await prisma.workflowOutbox.updateMany({
    where: { id: outboxId, status: 'PENDING', lastError: `${DISPATCH_LEASE_PREFIX}${leaseToken}` },
    data: { lastError: null },
  })
}

async function finalizeOutboxDispatch(
  outboxId: string,
  workflowJobId: string,
  expectedFingerprint: string,
  leaseToken: string,
): Promise<boolean> {
  const updated = await prisma.workflowOutbox.updateMany({
    where: {
      id: outboxId,
      status: 'PENDING',
      requestFingerprint: expectedFingerprint,
      lastError: `${DISPATCH_LEASE_PREFIX}${leaseToken}`,
    },
    data: {
      status: 'DISPATCHED',
      workflowJobId,
      dispatchedAt: new Date(),
      lastError: null,
    },
  })
  return updated.count === 1
}

async function failOutboxRow(outboxId: string, reason: string, leaseToken?: string): Promise<void> {
  await prisma.workflowOutbox.updateMany({
    where: leaseToken
      ? { id: outboxId, status: 'PENDING', lastError: `${DISPATCH_LEASE_PREFIX}${leaseToken}` }
      : { id: outboxId, status: 'PENDING' },
    data: { status: 'FAILED', lastError: reason },
  })
}

async function dispatchOutboxRow(row: WorkflowOutbox): Promise<'dispatched' | 'failed' | 'skipped'> {
  if (row.workflowJobId) {
    await prisma.workflowOutbox.updateMany({
      where: { id: row.id, status: 'PENDING' },
      data: { status: 'DISPATCHED', dispatchedAt: row.dispatchedAt ?? new Date() },
    })
    return 'skipped'
  }

  const leaseToken = await claimOutboxDispatchLease(row.id)
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

    const existingJob = await prisma.workflowJob.findUnique({
      where: { idempotencyKey: envelope.enqueue.idempotencyKey },
    })
    if (existingJob) {
      if (!workflowJobMatchesOutboxEnvelope(existingJob, envelope)) {
        await failOutboxRow(row.id, 'OUTBOX_REPLAY_CONFLICT', leaseToken)
        return 'failed'
      }
      const ok = await finalizeOutboxDispatch(row.id, existingJob.id, row.requestFingerprint, leaseToken)
      return ok ? 'dispatched' : 'skipped'
    }

    const result = await prismaWorkflowProvider.enqueue(envelope.enqueue)
    if (!result.ok) {
      if (result.error === 'IDEMPOTENCY_CONFLICT') {
        const replay = await prisma.workflowJob.findUnique({
          where: { idempotencyKey: envelope.enqueue.idempotencyKey },
        })
        if (replay && workflowJobMatchesOutboxEnvelope(replay, envelope)) {
          const ok = await finalizeOutboxDispatch(row.id, replay.id, row.requestFingerprint, leaseToken)
          return ok ? 'dispatched' : 'skipped'
        }
        await failOutboxRow(row.id, 'OUTBOX_REPLAY_CONFLICT', leaseToken)
        return 'failed'
      }
      await releaseOutboxDispatchLease(row.id, leaseToken)
      return 'failed'
    }

    if (!workflowJobMatchesOutboxEnvelope(
      {
        idempotencyKey: result.value.idempotencyKey,
        requestFingerprint: result.value.requestFingerprint,
        customerAccountId: result.value.customerAccountId,
        jobKind: result.value.jobKind,
        sourceType: result.value.sourceType,
        sourceId: result.value.sourceId,
      },
      envelope,
    )) {
      await failOutboxRow(row.id, 'ENQUEUE_FINGERPRINT_CONFLICT', leaseToken)
      return 'failed'
    }

    const ok = await finalizeOutboxDispatch(row.id, result.value.id, row.requestFingerprint, leaseToken)
    return ok ? 'dispatched' : 'skipped'
  } catch {
    await releaseOutboxDispatchLease(row.id, leaseToken)
    return 'failed'
  }
}

export async function dispatchPendingOutbox(limit = 25): Promise<number> {
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
    const outcome = await dispatchOutboxRow(row)
    if (outcome === 'dispatched') dispatched += 1
  }
  return dispatched
}

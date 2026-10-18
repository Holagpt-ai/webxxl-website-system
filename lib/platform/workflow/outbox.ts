import type { Prisma, WorkflowOutbox } from '@prisma/client'
import { prisma } from '@/lib/db'
import {
  buildWorkflowOutboxEnvelope,
  parseWorkflowOutboxEnvelope,
} from '@/lib/platform/workflow/outbox-envelope'
import { prismaWorkflowProvider } from '@/lib/platform/workflow/prisma-provider'
import type { EnqueueWorkflowJobInput } from '@/lib/platform/workflow/types'

type Db = typeof prisma | Prisma.TransactionClient

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

async function finalizeOutboxDispatch(
  outboxId: string,
  workflowJobId: string,
  expectedFingerprint: string,
): Promise<boolean> {
  const updated = await prisma.workflowOutbox.updateMany({
    where: {
      id: outboxId,
      status: 'PENDING',
      requestFingerprint: expectedFingerprint,
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

async function dispatchOutboxRow(row: WorkflowOutbox): Promise<'dispatched' | 'failed' | 'skipped'> {
  if (row.workflowJobId) {
    await prisma.workflowOutbox.updateMany({
      where: { id: row.id, status: 'PENDING' },
      data: { status: 'DISPATCHED', dispatchedAt: row.dispatchedAt ?? new Date() },
    })
    return 'skipped'
  }

  const envelope = parseWorkflowOutboxEnvelope(row.payloadRef)
  if (!envelope || envelope.eventKey !== row.eventKey) {
    await prisma.workflowOutbox.updateMany({
      where: { id: row.id, status: 'PENDING' },
      data: { status: 'FAILED', lastError: 'Invalid outbox envelope' },
    })
    return 'failed'
  }
  if (envelope.requestFingerprint !== row.requestFingerprint) {
    await prisma.workflowOutbox.updateMany({
      where: { id: row.id, status: 'PENDING' },
      data: { status: 'FAILED', lastError: 'Fingerprint mismatch' },
    })
    return 'failed'
  }

  const existingJob = await prisma.workflowJob.findUnique({
    where: { idempotencyKey: envelope.enqueue.idempotencyKey },
  })
  if (existingJob) {
    const ok = await finalizeOutboxDispatch(row.id, existingJob.id, row.requestFingerprint)
    return ok ? 'dispatched' : 'skipped'
  }

  const result = await prismaWorkflowProvider.enqueue(envelope.enqueue)
  if (!result.ok) {
    if (result.error === 'IDEMPOTENCY_CONFLICT') {
      const replay = await prisma.workflowJob.findUnique({
        where: { idempotencyKey: envelope.enqueue.idempotencyKey },
      })
      if (replay) {
        const ok = await finalizeOutboxDispatch(row.id, replay.id, row.requestFingerprint)
        return ok ? 'dispatched' : 'skipped'
      }
    }
    await prisma.workflowOutbox.updateMany({
      where: { id: row.id, status: 'PENDING' },
      data: {
        status: result.error === 'IDEMPOTENCY_CONFLICT' ? 'FAILED' : 'PENDING',
        lastError: result.message ?? result.error,
      },
    })
    return 'failed'
  }

  const ok = await finalizeOutboxDispatch(row.id, result.value.id, row.requestFingerprint)
  return ok ? 'dispatched' : 'skipped'
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

import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { buildWorkflowRequestFingerprint } from '@/lib/platform/workflow/fingerprint'
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
  const fingerprint = buildWorkflowRequestFingerprint({
    customerAccountId: input.enqueue.customerAccountId,
    managedSiteId: input.enqueue.managedSiteId,
    billingGroupId: input.enqueue.billingGroupId,
    jobKind: input.enqueue.jobKind,
    sourceType: input.enqueue.sourceType,
    sourceId: input.enqueue.sourceId,
    sourceRevisionHash: input.enqueue.sourceRevisionHash,
    payloadRef: input.payloadRef,
  })
  await db.workflowOutbox.create({
    data: {
      eventKey: input.eventKey,
      customerAccountId: input.customerAccountId ?? null,
      jobKind: input.jobKind,
      payloadRef: input.payloadRef as Prisma.InputJsonValue,
      requestFingerprint: fingerprint,
      status: 'PENDING',
    },
  })
}

export async function dispatchPendingOutbox(limit = 25): Promise<number> {
  const rows = await prisma.workflowOutbox.findMany({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
    take: limit,
  })
  let dispatched = 0
  for (const row of rows) {
    const payload = row.payloadRef as Record<string, unknown>
    const enqueueInput = payload.enqueue as EnqueueWorkflowJobInput | undefined
    if (!enqueueInput) {
      await prisma.workflowOutbox.update({
        where: { id: row.id },
        data: { status: 'FAILED', lastError: 'Missing enqueue payload' },
      })
      continue
    }
    const result = await prismaWorkflowProvider.enqueue(enqueueInput)
    if (!result.ok) {
      await prisma.workflowOutbox.update({
        where: { id: row.id },
        data: {
          status: result.error === 'IDEMPOTENCY_CONFLICT' ? 'FAILED' : 'PENDING',
          lastError: result.message ?? result.error,
        },
      })
      continue
    }
    await prisma.workflowOutbox.update({
      where: { id: row.id },
      data: { status: 'DISPATCHED', workflowJobId: result.value.id, dispatchedAt: new Date() },
    })
    dispatched += 1
  }
  return dispatched
}

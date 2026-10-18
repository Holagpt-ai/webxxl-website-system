import type { CrmTimelineEventKind, Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import type { CrmResult } from '@/lib/platform/crm/types'

export async function appendCrmTimelineEvent(input: {
  customerAccountId: string
  contactId: string
  eventKind: CrmTimelineEventKind
  sourceSystem: string
  idempotencyKey: string
  eventAt: Date
  externalEventId?: string
  actorUserId?: string
  channel?: string
  direction?: string
  disposition?: string
  provenanceRef?: string
  detail?: Record<string, unknown>
}): Promise<CrmResult<{ id: string; deduped: boolean }>> {
  const existing = await prisma.crmTimelineEvent.findUnique({ where: { idempotencyKey: input.idempotencyKey } })
  if (existing) {
    if (existing.customerAccountId !== input.customerAccountId) {
      return { ok: false, code: 'CONFLICT', message: 'Timeline idempotency conflict' }
    }
    return { ok: true, value: { id: existing.id, deduped: true } }
  }
  const row = await prisma.crmTimelineEvent.create({
    data: {
      customerAccountId: input.customerAccountId,
      contactId: input.contactId,
      eventKind: input.eventKind,
      sourceSystem: input.sourceSystem,
      idempotencyKey: input.idempotencyKey,
      eventAt: input.eventAt,
      externalEventId: input.externalEventId,
      actorUserId: input.actorUserId,
      channel: input.channel,
      direction: input.direction,
      disposition: input.disposition,
      provenanceRef: input.provenanceRef,
      detail: input.detail as Prisma.InputJsonValue | undefined,
    },
  })
  await prisma.crmContact.update({
    where: { id: input.contactId },
    data: { lastActivityAt: input.eventAt, firstActivityAt: input.eventAt },
  })
  return { ok: true, value: { id: row.id, deduped: false } }
}

export async function listContactTimeline(contactId: string, customerAccountId: string, take = 50) {
  return prisma.crmTimelineEvent.findMany({
    where: { contactId, customerAccountId },
    orderBy: { eventAt: 'desc' },
    take,
  })
}

import type { CrmTimelineEventKind, Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { assertCrmContactOwnedByAccount } from '@/lib/platform/crm/contact-guard'
import type { CrmResult } from '@/lib/platform/crm/types'

function timelinePayloadMatches(
  existing: { customerAccountId: string; contactId: string; eventKind: CrmTimelineEventKind; eventAt: Date },
  input: { customerAccountId: string; contactId: string; eventKind: CrmTimelineEventKind; eventAt: Date },
): boolean {
  return (
    existing.customerAccountId === input.customerAccountId &&
    existing.contactId === input.contactId &&
    existing.eventKind === input.eventKind &&
    existing.eventAt.getTime() === input.eventAt.getTime()
  )
}

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
  const owned = await assertCrmContactOwnedByAccount(input.contactId, input.customerAccountId)
  if (!owned.ok) return owned

  const existing = await prisma.crmTimelineEvent.findUnique({ where: { idempotencyKey: input.idempotencyKey } })
  if (existing) {
    if (!timelinePayloadMatches(existing, input)) {
      return { ok: false, code: 'CONFLICT', message: 'Timeline idempotency key reused with different payload' }
    }
    return { ok: true, value: { id: existing.id, deduped: true } }
  }

  const result = await prisma.$transaction(async (tx) => {
    const row = await tx.crmTimelineEvent.create({
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
    const contact = await tx.crmContact.findUnique({ where: { id: input.contactId } })
    if (!contact) throw new Error('CONTACT_MISSING')
    const firstActivityAt =
      contact.firstActivityAt && contact.firstActivityAt.getTime() < input.eventAt.getTime()
        ? contact.firstActivityAt
        : input.eventAt
    const lastActivityAt =
      contact.lastActivityAt && contact.lastActivityAt.getTime() > input.eventAt.getTime()
        ? contact.lastActivityAt
        : input.eventAt
    await tx.crmContact.update({
      where: { id: input.contactId },
      data: { firstActivityAt, lastActivityAt },
    })
    return row
  })

  return { ok: true, value: { id: result.id, deduped: false } }
}

export async function listContactTimeline(contactId: string, customerAccountId: string, take = 50) {
  const owned = await assertCrmContactOwnedByAccount(contactId, customerAccountId)
  if (!owned.ok) return []
  const boundedTake = Math.min(Math.max(take, 1), 100)
  return prisma.crmTimelineEvent.findMany({
    where: { contactId, customerAccountId },
    orderBy: { eventAt: 'desc' },
    take: boundedTake,
  })
}

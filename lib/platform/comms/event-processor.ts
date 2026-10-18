import { prisma } from '@/lib/db'
import { appendCrmTimelineEvent } from '@/lib/platform/crm/timeline-service'
import {
  mergeConversationActivityTimestamps,
  translateChatwootConversationStatus,
} from '@/lib/platform/comms/conversation-service'
import { resolveInboundChatwootContact } from '@/lib/platform/comms/contact-resolution-service'
import type { ChatwootWebhookEnvelope } from '@/lib/platform/comms/webhook-schemas'
import type { CommsResult } from '@/lib/platform/comms/types'
import type { CrmTimelineEventKind } from '@prisma/client'

function timelineKindForEvent(event: ChatwootWebhookEnvelope['event'], messageType?: string | number): CrmTimelineEventKind {
  if (event === 'message_created') {
    const mt = String(messageType ?? '').toLowerCase()
    if (mt.includes('incoming') || mt === '0') return 'INBOUND_SMS'
    if (mt.includes('outgoing') || mt === '1') return 'HUMAN_REPLY'
    return 'WEB_CHAT_STARTED'
  }
  if (event === 'conversation_created') return 'WEB_CHAT_STARTED'
  return 'NOTE'
}

export async function processChatwootWebhookReceipt(input: {
  receiptId: string
  customerAccountId: string
  tenantMappingId: string
  envelope: ChatwootWebhookEnvelope
  idempotencyKey: string
}): Promise<CommsResult<{ processed: boolean }>> {
  const receipt = await prisma.commsWebhookReceipt.findUnique({ where: { id: input.receiptId } })
  if (!receipt) return { ok: false, code: 'NOT_FOUND', message: 'Receipt not found' }
  if (receipt.processingStatus === 'PROCESSED' || receipt.processingStatus === 'DUPLICATE') {
    return { ok: true, value: { processed: false } }
  }

  const conversationExternalId = input.envelope.conversation?.id != null ? String(input.envelope.conversation.id) : null
  const inboxId =
    input.envelope.inbox?.id != null
      ? String(input.envelope.inbox.id)
      : input.envelope.conversation?.inbox_id != null
        ? String(input.envelope.conversation.inbox_id)
        : 'unknown'

  let crmContactId: string | undefined
  const resolution = await resolveInboundChatwootContact({
    customerAccountId: input.customerAccountId,
    externalContactRef: String(input.envelope.message?.id ?? conversationExternalId ?? input.idempotencyKey),
  })
  if (resolution.ok && resolution.value.kind === 'MATCHED') {
    crmContactId = resolution.value.crmContactId
  }

  if (conversationExternalId) {
    const eventAt = new Date()
    const status = input.envelope.conversation?.status
      ? translateChatwootConversationStatus(input.envelope.conversation.status)
      : undefined

    await prisma.chatwootConversationMapping.upsert({
      where: {
        customerAccountId_externalConversationId: {
          customerAccountId: input.customerAccountId,
          externalConversationId: conversationExternalId,
        },
      },
      create: {
        customerAccountId: input.customerAccountId,
        tenantMappingId: input.tenantMappingId,
        externalConversationId: conversationExternalId,
        externalInboxId: inboxId,
        channel: 'web_chat',
        crmContactId: crmContactId ?? null,
        webxxlStatus: status ?? 'OPEN',
        lastActivityAt: eventAt,
        lastSyncAt: eventAt,
        coverageState: crmContactId ? 'PARTIAL' : 'UNKNOWN',
      },
      update: {
        lastSyncAt: eventAt,
        webxxlStatus: status ?? undefined,
        crmContactId: crmContactId ?? undefined,
      },
    })

    const existing = await prisma.chatwootConversationMapping.findFirst({
      where: { customerAccountId: input.customerAccountId, externalConversationId: conversationExternalId },
    })
    if (existing?.lastActivityAt) {
      const merged = mergeConversationActivityTimestamps({
        currentLast: existing.lastActivityAt,
        eventAt,
      })
      await prisma.chatwootConversationMapping.update({
        where: { id: existing.id },
        data: { lastActivityAt: merged.lastActivityAt },
      })
    }
  }

  if (crmContactId) {
    const kind = timelineKindForEvent(input.envelope.event, input.envelope.message?.message_type)
    const eventAt =
      typeof input.envelope.message?.created_at === 'number'
        ? new Date(input.envelope.message.created_at * 1000)
        : new Date()
    const timeline = await appendCrmTimelineEvent({
      customerAccountId: input.customerAccountId,
      contactId: crmContactId,
      eventKind: kind,
      sourceSystem: 'chatwoot.webhook',
      externalEventId: input.idempotencyKey,
      idempotencyKey: `chatwoot:${input.idempotencyKey}`,
      eventAt,
      detail: { event: input.envelope.event, conversationId: conversationExternalId },
    })
    if (!timeline.ok && timeline.code !== 'CONFLICT') {
      return { ok: false, code: 'VALIDATION', message: timeline.message }
    }
  }

  await prisma.commsWebhookReceipt.update({
    where: { id: input.receiptId },
    data: { processingStatus: 'PROCESSED', processedAt: new Date() },
  })

  return { ok: true, value: { processed: true } }
}

/** Provider acceptance must not be recorded as carrier delivery. */
export function mapProviderLifecycleToDispatchStatus(lifecycle: 'accepted' | 'delivered' | 'failed'): string {
  if (lifecycle === 'accepted') return 'ACCEPTED_BY_PROVIDER'
  if (lifecycle === 'delivered') return 'DELIVERED'
  return 'FAILED'
}

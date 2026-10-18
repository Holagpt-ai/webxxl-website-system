import { prisma } from '@/lib/db'
import { appendCrmTimelineEvent } from '@/lib/platform/crm/timeline-service'
import {
  mergeConversationActivityTimestamps,
  translateChatwootConversationStatus,
} from '@/lib/platform/comms/conversation-service'
import { resolveInboundChatwootContact } from '@/lib/platform/comms/contact-resolution-service'
import {
  classifyInboundTimelineEvent,
  inboxChannelKindFromChatwootType,
  webxxlChannelLabel,
} from '@/lib/platform/comms/channel-classifier'
import { isRecognizedOptOutBody, processInboundOptOut } from '@/lib/platform/comms/opt-out-service'
import type { ChatwootWebhookEnvelope } from '@/lib/platform/comms/webhook-schemas'
import type { CommsResult } from '@/lib/platform/comms/types'
import type { CrmConsentChannel } from '@prisma/client'

function parseMessageTimestamp(envelope: ChatwootWebhookEnvelope): Date | null {
  const raw = envelope.message?.created_at
  if (raw == null) return null
  const asNumber = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(asNumber)) return null
  return new Date(asNumber * 1000)
}

function optOutChannelFromInbox(kind: ReturnType<typeof inboxChannelKindFromChatwootType>): CrmConsentChannel | null {
  if (kind === 'SMS') return 'SMS'
  if (kind === 'EMAIL') return 'EMAIL'
  if (kind === 'WHATSAPP') return 'WHATSAPP'
  return null
}

export async function processTrustedChatwootReceiptPayload(input: {
  receiptId: string
  customerAccountId: string
  tenantMappingId: string
  envelope: ChatwootWebhookEnvelope
  inboxId: string | null
  eventDedupeKey: string
}): Promise<CommsResult<{ processed: boolean }>> {
  const inboxMapping = input.inboxId
    ? await prisma.chatwootInboxMapping.findFirst({
        where: {
          tenantMappingId: input.tenantMappingId,
          externalInboxId: input.inboxId,
          customerAccountId: input.customerAccountId,
          verificationState: 'VERIFIED',
        },
      })
    : null

  const inboxChannelKind = inboxChannelKindFromChatwootType(inboxMapping?.channelType)
  const channelLabel = webxxlChannelLabel(inboxChannelKind)

  const conversationExternalId =
    input.envelope.conversation?.id != null ? String(input.envelope.conversation.id) : null
  const inboxId = input.inboxId ?? 'unknown'

  let crmContactId: string | undefined
  const resolution = await resolveInboundChatwootContact({
    customerAccountId: input.customerAccountId,
    email: undefined,
    phone: undefined,
    externalContactRef: String(input.envelope.message?.id ?? conversationExternalId ?? input.eventDedupeKey),
  })
  if (resolution.ok && resolution.value.kind === 'MATCHED') {
    crmContactId = resolution.value.crmContactId
  }

  const eventAt = parseMessageTimestamp(input.envelope)
  const status = input.envelope.conversation?.status
    ? translateChatwootConversationStatus(input.envelope.conversation.status)
    : undefined

  if (conversationExternalId) {
    const activityAt = eventAt ?? undefined
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
        channel: channelLabel,
        crmContactId: crmContactId ?? null,
        webxxlStatus: status ?? 'OPEN',
        lastActivityAt: activityAt ?? null,
        lastSyncAt: new Date(),
        coverageState: crmContactId ? 'PARTIAL' : 'UNKNOWN',
      },
      update: {
        lastSyncAt: new Date(),
        channel: channelLabel,
        webxxlStatus: status ?? undefined,
        crmContactId: crmContactId ?? undefined,
        ...(activityAt ? { lastActivityAt: activityAt } : {}),
      },
    })

    if (activityAt) {
      const existing = await prisma.chatwootConversationMapping.findFirst({
        where: { customerAccountId: input.customerAccountId, externalConversationId: conversationExternalId },
      })
      if (existing?.lastActivityAt) {
        const merged = mergeConversationActivityTimestamps({
          currentLast: existing.lastActivityAt,
          eventAt: activityAt,
        })
        await prisma.chatwootConversationMapping.update({
          where: { id: existing.id },
          data: { lastActivityAt: merged.lastActivityAt },
        })
      }
    }
  }

  const messageBody = input.envelope.message?.content ?? ''
  const optOutChannel = optOutChannelFromInbox(inboxChannelKind)
  if (
    crmContactId &&
    optOutChannel &&
    input.envelope.event === 'message_created' &&
    isRecognizedOptOutBody(messageBody)
  ) {
    const stop = await processInboundOptOut({
      customerAccountId: input.customerAccountId,
      contactId: crmContactId,
      channel: optOutChannel as 'SMS' | 'EMAIL' | 'WHATSAPP',
      body: messageBody,
      source: `chatwoot:${input.receiptId}`,
      idempotencyKey: `stop:${input.eventDedupeKey}`,
      trustedSenderResolved: Boolean(inboxMapping),
    })
    if (!stop.ok && stop.code !== 'CONFLICT') {
      return stop
    }
  }

  if (crmContactId && input.envelope.event === 'message_created') {
    const senderType =
      typeof input.envelope.meta?.sender_type === 'string' ? input.envelope.meta.sender_type : undefined
    const kind = classifyInboundTimelineEvent({
      inboxChannel: inboxChannelKind,
      messageType: input.envelope.message?.message_type,
      senderType,
    })
    if (kind && eventAt) {
      const timeline = await appendCrmTimelineEvent({
        customerAccountId: input.customerAccountId,
        contactId: crmContactId,
        eventKind: kind,
        sourceSystem: 'chatwoot.webhook',
        externalEventId: input.eventDedupeKey,
        idempotencyKey: `chatwoot:${input.eventDedupeKey}`,
        eventAt,
        detail: { event: input.envelope.event, conversationId: conversationExternalId, channel: channelLabel },
      })
      if (!timeline.ok && timeline.code !== 'CONFLICT') {
        return { ok: false, code: 'VALIDATION', message: timeline.message }
      }
    }
  }

  return { ok: true, value: { processed: true } }
}

/** Provider acceptance must not be recorded as carrier delivery. */
export function mapProviderLifecycleToDispatchStatus(lifecycle: 'accepted' | 'delivered' | 'failed'): string {
  if (lifecycle === 'accepted') return 'ACCEPTED_BY_PROVIDER'
  if (lifecycle === 'delivered') return 'DELIVERED'
  return 'FAILED'
}

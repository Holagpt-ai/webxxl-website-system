import { prisma } from '@/lib/db'
import { getAccountConversation } from '@/lib/platform/comms/conversation-service'
import { prepareCommunicationIntent } from '@/lib/platform/comms/gateway-service'
import { prepareCommunicationQuote } from '@/lib/platform/comms/quote-service'
import type { CommsResult } from '@/lib/platform/comms/types'
import type { CrmConsentChannel, CrmConsentPurpose, CrmChannelIdentityType } from '@prisma/client'

export type ConversationReplyIntentSummary = {
  id: string
  status: string
  channel: CrmConsentChannel
  purpose: CrmConsentPurpose
  policyDecision: string
  createdAt: string
}

export type ConversationReplyContext = {
  conversationId: string
  deliveryBlocked: true
  /** WebXXL conversation channel label (`email`, `sms`, `web_chat`, …). */
  channel: string
  consentChannel: CrmConsentChannel | null
  purpose: CrmConsentPurpose
  crmContactId: string | null
  recipientAddress: string | null
  recipientResolution: 'RESOLVED' | 'MISSING_IDENTITY' | 'UNSUPPORTED_CHANNEL' | 'NO_CONTACT'
  quote: {
    quoteId: string
    eligibleCount: number
    suppressedCount: number
    unknownConsentCount: number
    invalidContactCount: number
    policyDecision: string
  } | null
  recentIntents: ConversationReplyIntentSummary[]
}

const PURPOSE: CrmConsentPurpose = 'TRANSACTIONAL'

function webxxlChannelToConsentChannel(channel: string): CrmConsentChannel | null {
  switch (channel) {
    case 'email':
      return 'EMAIL'
    case 'sms':
      return 'SMS'
    case 'whatsapp':
      return 'WHATSAPP'
    default:
      return null
  }
}

function identityTypeForConsentChannel(channel: CrmConsentChannel): CrmChannelIdentityType {
  switch (channel) {
    case 'EMAIL':
      return 'EMAIL'
    case 'SMS':
      return 'PHONE'
    case 'WHATSAPP':
      return 'WHATSAPP'
    default:
      return 'OTHER'
  }
}

async function resolveRecipientAddress(input: {
  customerAccountId: string
  contactId: string
  consentChannel: CrmConsentChannel
}): Promise<string | null> {
  const identityType = identityTypeForConsentChannel(input.consentChannel)
  const primary = await prisma.crmContactChannelIdentity.findFirst({
    where: {
      customerAccountId: input.customerAccountId,
      contactId: input.contactId,
      identityType,
      isPrimary: true,
    },
    select: { displayValue: true, normalizedValue: true },
  })
  if (primary) return primary.normalizedValue || primary.displayValue
  const fallback = await prisma.crmContactChannelIdentity.findFirst({
    where: {
      customerAccountId: input.customerAccountId,
      contactId: input.contactId,
      identityType,
    },
    orderBy: { createdAt: 'asc' },
    select: { displayValue: true, normalizedValue: true },
  })
  return fallback ? fallback.normalizedValue || fallback.displayValue : null
}

async function listRecentIntentsForContact(customerAccountId: string, crmContactId: string): Promise<ConversationReplyIntentSummary[]> {
  const rows = await prisma.communicationIntent.findMany({
    where: {
      customerAccountId,
      recipients: { some: { crmContactId } },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      id: true,
      status: true,
      channel: true,
      purpose: true,
      policyDecision: true,
      createdAt: true,
    },
  })
  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    channel: row.channel,
    purpose: row.purpose,
    policyDecision: row.policyDecision,
    createdAt: row.createdAt.toISOString(),
  }))
}

export async function getConversationReplyContext(input: {
  customerAccountId: string
  actorUserId: string
  conversationMappingId: string
}): Promise<CommsResult<ConversationReplyContext>> {
  const conv = await getAccountConversation({
    customerAccountId: input.customerAccountId,
    conversationMappingId: input.conversationMappingId,
  })
  if (!conv.ok) return conv

  const consentChannel = webxxlChannelToConsentChannel(conv.value.channel)
  const crmContactId = conv.value.crmContact?.id ?? null
  let recipientAddress: string | null = null
  let recipientResolution: ConversationReplyContext['recipientResolution'] = 'NO_CONTACT'

  if (!crmContactId) {
    recipientResolution = 'NO_CONTACT'
  } else if (!consentChannel) {
    recipientResolution = 'UNSUPPORTED_CHANNEL'
  } else {
    recipientAddress = await resolveRecipientAddress({
      customerAccountId: input.customerAccountId,
      contactId: crmContactId,
      consentChannel,
    })
    recipientResolution = recipientAddress ? 'RESOLVED' : 'MISSING_IDENTITY'
  }

  let quote: ConversationReplyContext['quote'] = null
  if (crmContactId && consentChannel) {
    const quoteResult = await prepareCommunicationQuote({
      customerAccountId: input.customerAccountId,
      actorUserId: input.actorUserId,
      channel: consentChannel,
      purpose: PURPOSE,
      recipientContactIds: [crmContactId],
    })
    if (quoteResult.ok) {
      quote = {
        quoteId: quoteResult.value.quoteId,
        eligibleCount: quoteResult.value.eligibleCount,
        suppressedCount: quoteResult.value.suppressedCount,
        unknownConsentCount: quoteResult.value.unknownConsentCount,
        invalidContactCount: quoteResult.value.invalidContactCount,
        policyDecision: quoteResult.value.policyDecision,
      }
    }
  }

  const recentIntents = crmContactId
    ? await listRecentIntentsForContact(input.customerAccountId, crmContactId)
    : []

  return {
    ok: true,
    value: {
      conversationId: conv.value.id,
      deliveryBlocked: true,
      channel: conv.value.channel,
      consentChannel,
      purpose: PURPOSE,
      crmContactId,
      recipientAddress,
      recipientResolution,
      quote,
      recentIntents,
    },
  }
}

export async function prepareConversationReply(input: {
  customerAccountId: string
  actorUserId: string
  conversationMappingId: string
  idempotencyKey: string
  contentVersion?: string
  recipientAddressOverride?: string
}): Promise<CommsResult<{ intent: { intentId: string; status: string; policyDecision: string } }>> {
  const context = await getConversationReplyContext({
    customerAccountId: input.customerAccountId,
    actorUserId: input.actorUserId,
    conversationMappingId: input.conversationMappingId,
  })
  if (!context.ok) return context

  const { consentChannel, crmContactId, recipientAddress, recipientResolution } = context.value
  if (!crmContactId) {
    return { ok: false, code: 'VALIDATION', message: 'Link a CRM contact before preparing a reply' }
  }
  if (!consentChannel) {
    return { ok: false, code: 'VALIDATION', message: 'This conversation channel cannot be mapped for outbound preparation' }
  }

  const address = (input.recipientAddressOverride?.trim() || recipientAddress || '').trim()
  if (!address) {
    return {
      ok: false,
      code: 'VALIDATION',
      message:
        recipientResolution === 'MISSING_IDENTITY'
          ? 'No recipient address on the CRM contact for this channel'
          : 'Recipient address required',
    }
  }

  const prepared = await prepareCommunicationIntent({
    customerAccountId: input.customerAccountId,
    actorUserId: input.actorUserId,
    channel: consentChannel,
    purpose: PURPOSE,
    recipientAddress: address,
    crmContactId,
    contentVersion: input.contentVersion ?? 'comms-reply-v0',
    policyVersion: 'comms-policy-v0',
    idempotencyKey: input.idempotencyKey,
    dataClassification: 'GENERAL_BUSINESS',
    aiActor: false,
  })
  if (!prepared.ok) return prepared

  return {
    ok: true,
    value: {
      intent: {
        intentId: prepared.value.intentId,
        status: prepared.value.status,
        policyDecision: prepared.value.policyDecision,
      },
    },
  }
}
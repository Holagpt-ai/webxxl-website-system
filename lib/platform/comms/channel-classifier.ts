import type { CrmTimelineEventKind } from '@prisma/client'

export type InboxChannelKind = 'WEB_CHAT' | 'SMS' | 'EMAIL' | 'SOCIAL_DM' | 'WHATSAPP' | 'UNKNOWN'

/** Map Chatwoot inbox channel_type strings (Application API) to WebXXL channel kind. */
export function inboxChannelKindFromChatwootType(channelType: string | null | undefined): InboxChannelKind {
  if (!channelType) return 'UNKNOWN'
  const normalized = channelType.toLowerCase()
  if (normalized.includes('sms') || normalized.includes('twilio')) return 'SMS'
  if (normalized.includes('email')) return 'EMAIL'
  if (normalized.includes('webwidget') || normalized.includes('web_widget') || normalized.includes('website'))
    return 'WEB_CHAT'
  if (
    normalized.includes('facebook') ||
    normalized.includes('instagram') ||
    normalized.includes('twitter') ||
    normalized.includes('telegram') ||
    normalized.includes('line')
  ) {
    return 'SOCIAL_DM'
  }
  if (normalized.includes('whatsapp')) return 'WHATSAPP'
  if (normalized.includes('api')) return 'WEB_CHAT'
  return 'UNKNOWN'
}

export function webxxlChannelLabel(kind: InboxChannelKind): string {
  switch (kind) {
    case 'WEB_CHAT':
      return 'web_chat'
    case 'SMS':
      return 'sms'
    case 'EMAIL':
      return 'email'
    case 'SOCIAL_DM':
      return 'social_dm'
    case 'WHATSAPP':
      return 'whatsapp'
    default:
      return 'unknown'
  }
}

export function classifyInboundTimelineEvent(input: {
  inboxChannel: InboxChannelKind
  messageType?: string | number
  senderType?: string
}): CrmTimelineEventKind | null {
  const mt = String(input.messageType ?? '').toLowerCase()
  const isIncoming = mt === '0' || mt.includes('incoming') || mt === 'incoming'
  const isOutgoing = mt === '1' || mt.includes('outgoing') || mt === 'outgoing'

  if (input.inboxChannel === 'SMS' && isIncoming) return 'INBOUND_SMS'
  if (input.inboxChannel === 'SOCIAL_DM' && isIncoming) return 'SOCIAL_DM_RECEIVED'
  if (input.inboxChannel === 'EMAIL' && isOutgoing) return 'EMAIL_SENT'
  if (input.inboxChannel === 'WEB_CHAT' && isIncoming) return 'WEB_CHAT_STARTED'

  if (isOutgoing) {
    if (input.senderType?.toLowerCase() === 'agent_bot' || input.senderType?.toLowerCase() === 'bot') return 'AI_REPLY'
    return 'HUMAN_REPLY'
  }
  if (isIncoming && input.inboxChannel === 'WEB_CHAT') return 'WEB_CHAT_STARTED'
  return null
}

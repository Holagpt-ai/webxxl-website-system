/** Subset of Chatwoot webhook event names documented for agent/inbox integrations (v4.x). */
export const CHATWOOT_WEBHOOK_EVENT_TYPES = [
  'conversation_created',
  'conversation_updated',
  'conversation_status_changed',
  'message_created',
  'message_updated',
  'contact_updated',
  'assignee_changed',
] as const

export type ChatwootWebhookEventType = (typeof CHATWOOT_WEBHOOK_EVENT_TYPES)[number]

export type ChatwootWebhookEnvelope = {
  event: ChatwootWebhookEventType
  id?: number | string
  account?: { id: number | string }
  inbox?: { id: number | string }
  conversation?: { id: number | string; inbox_id?: number | string; status?: string }
  message?: { id: number | string; content?: string; message_type?: number | string; created_at?: number | string }
  meta?: Record<string, unknown>
}

export function parseChatwootWebhookEnvelope(raw: unknown): ChatwootWebhookEnvelope | null {
  if (!raw || typeof raw !== 'object') return null
  const body = raw as Record<string, unknown>
  const event = body.event
  if (typeof event !== 'string') return null
  if (!(CHATWOOT_WEBHOOK_EVENT_TYPES as readonly string[]).includes(event)) return null
  return body as ChatwootWebhookEnvelope
}

export function externalEventIdFromEnvelope(body: ChatwootWebhookEnvelope): string {
  const messageId = body.message?.id
  const conversationId = body.conversation?.id
  const rootId = body.id
  return String(messageId ?? conversationId ?? rootId ?? 'unknown')
}

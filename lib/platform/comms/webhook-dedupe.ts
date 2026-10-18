import { createHash } from 'node:crypto'
import type { ChatwootWebhookEnvelope } from '@/lib/platform/comms/webhook-schemas'

/** Stable provider-scoped external reference for dedupe (not globally unique alone). */
export function scopedExternalEventRef(
  envelope: ChatwootWebhookEnvelope,
  payloadHash: string,
): string {
  const messageId = envelope.message?.id
  const conversationId = envelope.conversation?.id
  const rootId = envelope.id
  if (messageId != null) return `msg:${messageId}`
  if (conversationId != null) return `conv:${conversationId}:${envelope.event}`
  if (rootId != null) return `evt:${rootId}`
  return `fp:${payloadHash.slice(0, 32)}`
}

/** Durable dedupe key: provider instance + verified account + event type + external ref. */
export function buildWebhookEventDedupeKey(input: {
  providerInstanceId: string
  externalAccountId: string
  eventType: string
  externalEventRef: string
}): string {
  return createHash('sha256')
    .update(
      [input.providerInstanceId, input.externalAccountId, input.eventType, input.externalEventRef].join('|'),
    )
    .digest('hex')
}

export function buildWebhookPayloadFingerprint(rawBody: string): string {
  return createHash('sha256').update(rawBody).digest('hex')
}

/** Optional client idempotency key must not replace scoped dedupe; combined for audit only. */
export function buildWebhookIdempotencyKey(input: {
  eventDedupeKey: string
  clientIdempotencyKey?: string | null
}): string {
  if (input.clientIdempotencyKey && input.clientIdempotencyKey.trim().length > 0) {
    return createHash('sha256')
      .update(`${input.eventDedupeKey}|client:${input.clientIdempotencyKey.trim()}`)
      .digest('hex')
  }
  return input.eventDedupeKey
}

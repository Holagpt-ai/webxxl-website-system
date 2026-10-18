import { prisma } from '@/lib/db'
import { recordContactSuppression } from '@/lib/platform/crm/consent-service'
import type { CommsResult } from '@/lib/platform/comms/types'

const STOP_PATTERNS = [/^stop\b/i, /^unsubscribe\b/i, /^cancel\b/i]

export function isRecognizedOptOutBody(body: string): boolean {
  const trimmed = body.trim()
  return STOP_PATTERNS.some((re) => re.test(trimmed))
}

export async function processInboundOptOut(input: {
  customerAccountId: string
  contactId: string
  channel: 'SMS' | 'EMAIL' | 'WHATSAPP'
  body: string
  source: string
  idempotencyKey: string
  trustedSenderResolved: boolean
}): Promise<CommsResult<{ suppressed: boolean; duplicate?: boolean }>> {
  if (!input.trustedSenderResolved) {
    return { ok: false, code: 'QUARANTINED', message: 'Opt-out requires trusted inbound sender resolution' }
  }
  if (!isRecognizedOptOutBody(input.body)) {
    return { ok: false, code: 'VALIDATION', message: 'Not a recognized opt-out message' }
  }
  const prior =
    input.idempotencyKey != null
      ? await prisma.contactSuppression.findUnique({ where: { idempotencyKey: input.idempotencyKey } })
      : null
  const result = await recordContactSuppression({
    customerAccountId: input.customerAccountId,
    contactId: input.contactId,
    channel: input.channel,
    purpose: 'MARKETING',
    reason: 'inbound_stop',
    source: input.source,
    idempotencyKey: input.idempotencyKey,
  })
  if (!result.ok) {
    return { ok: false, code: 'CONFLICT', message: result.message }
  }
  return { ok: true, value: { suppressed: true, duplicate: Boolean(prior) } }
}

/** Second call with identical verified payload is a duplicate success. */
export async function processInboundOptOutIdempotent(input: {
  customerAccountId: string
  contactId: string
  channel: 'SMS' | 'EMAIL' | 'WHATSAPP'
  body: string
  source: string
  idempotencyKey: string
  trustedSenderResolved: boolean
}): Promise<CommsResult<{ suppressed: boolean; duplicate?: boolean }>> {
  const first = await processInboundOptOut(input)
  if (!first.ok) return first
  const second = await processInboundOptOut(input)
  if (!second.ok) return second
  return { ok: true, value: { suppressed: true, duplicate: true } }
}

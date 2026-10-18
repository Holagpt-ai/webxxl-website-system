import { createHmac, timingSafeEqual } from 'node:crypto'
import type { CommsResult } from '@/lib/platform/comms/types'

/**
 * Chatwoot CE does not provide a universal signed-webhook header in all editions.
 * WebXXL uses a verified private relay secret per provider instance / tenant mapping.
 */
export function verifyChatwootRelaySignature(input: {
  rawBody: string
  signatureHeader: string | null
  relaySecret: string | null
}): CommsResult<true> {
  if (!input.relaySecret) {
    return { ok: false, code: 'NOT_CONFIGURED', message: 'Webhook relay secret not configured' }
  }
  if (!input.signatureHeader) {
    return { ok: false, code: 'UNAUTHORIZED', message: 'Missing webhook signature' }
  }
  const expected = createHmac('sha256', input.relaySecret).update(input.rawBody).digest('hex')
  const provided = input.signatureHeader.replace(/^sha256=/, '')
  try {
    const a = Buffer.from(expected)
    const b = Buffer.from(provided)
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false, code: 'UNAUTHORIZED', message: 'Invalid webhook signature' }
    }
  } catch {
    return { ok: false, code: 'UNAUTHORIZED', message: 'Invalid webhook signature' }
  }
  return { ok: true, value: true }
}

export function verifyWebhookTimestamp(input: {
  eventTimestamp?: number
  nowMs?: number
  toleranceSeconds: number
}): CommsResult<true> {
  if (input.eventTimestamp === undefined) return { ok: true, value: true }
  const now = input.nowMs ?? Date.now()
  const delta = Math.abs(now - input.eventTimestamp * 1000)
  if (delta > input.toleranceSeconds * 1000) {
    return { ok: false, code: 'UNAUTHORIZED', message: 'Webhook timestamp outside tolerance' }
  }
  return { ok: true, value: true }
}

import { createHmac, timingSafeEqual } from 'node:crypto'
import type { CommsResult } from '@/lib/platform/comms/types'

export type VerifiedRelayAuth = {
  relayTimestampSeconds: number
}

/**
 * Chatwoot CE does not provide a universal signed-webhook header in all editions.
 * WebXXL private relay signs `${timestamp}.${rawBody}` — timestamp is bound to the signature.
 */
export function verifyChatwootRelaySignature(input: {
  rawBody: string
  signatureHeader: string | null
  timestampHeader: string | null
  relaySecret: string | null
  toleranceSeconds: number
  nowMs?: number
}): CommsResult<VerifiedRelayAuth> {
  if (!input.relaySecret) {
    return { ok: false, code: 'NOT_CONFIGURED', message: 'Webhook relay secret not configured' }
  }
  if (!input.signatureHeader) {
    return { ok: false, code: 'UNAUTHORIZED', message: 'Missing webhook signature' }
  }
  if (!input.timestampHeader) {
    return { ok: false, code: 'UNAUTHORIZED', message: 'Missing relay timestamp (must be signature-bound)' }
  }
  const relayTimestampSeconds = Number(input.timestampHeader)
  if (!Number.isFinite(relayTimestampSeconds) || relayTimestampSeconds <= 0) {
    return { ok: false, code: 'UNAUTHORIZED', message: 'Invalid relay timestamp' }
  }

  const now = input.nowMs ?? Date.now()
  const delta = Math.abs(now - relayTimestampSeconds * 1000)
  if (delta > input.toleranceSeconds * 1000) {
    return { ok: false, code: 'UNAUTHORIZED', message: 'Relay timestamp outside tolerance' }
  }

  const signedPayload = `${relayTimestampSeconds}.${input.rawBody}`
  const expected = createHmac('sha256', input.relaySecret).update(signedPayload).digest('hex')
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
  return { ok: true, value: { relayTimestampSeconds } }
}

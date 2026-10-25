import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { ANALYTICS_CAPTURE_SIGNATURE_TOLERANCE_SECONDS } from '@/config/analytics-backend'

export type CaptureAuthError = 'NOT_CONFIGURED' | 'UNAUTHORIZED' | 'VALIDATION'

export function hashCaptureSecret(secret: string): string {
  return createHash('sha256').update(secret, 'utf8').digest('hex')
}

/** Signing secret must remain on the managed site's trusted server — never in browser JavaScript. */
export function resolveCaptureSecretMaterial(input: {
  publicKeyId: string
  secretRef: string | null
  secretHash: string
}): { ok: true; secret: string } | { ok: false; code: CaptureAuthError; message: string } {
  const candidates: string[] = []
  if (input.secretRef) {
    const fromRef = process.env[input.secretRef]
    if (fromRef) candidates.push(fromRef)
  }
  const envKey = `ANALYTICS_CAPTURE_SECRET_${input.publicKeyId}`
  const fromEnv = process.env[envKey]
  if (fromEnv) candidates.push(fromEnv)
  for (const secret of candidates) {
    if (hashCaptureSecret(secret) === input.secretHash) {
      return { ok: true, secret }
    }
  }
  return { ok: false, code: 'NOT_CONFIGURED', message: 'Capture secret not configured for site key' }
}

export function verifyCaptureRequestSignature(input: {
  rawBody: string
  signatureHeader: string | null
  timestampHeader: string | null
  secret: string
  toleranceSeconds?: number
  nowMs?: number
}): { ok: true; timestampSeconds: number } | { ok: false; code: CaptureAuthError; message: string } {
  if (!input.signatureHeader) {
    return { ok: false, code: 'UNAUTHORIZED', message: 'Missing capture signature' }
  }
  if (!input.timestampHeader) {
    return { ok: false, code: 'UNAUTHORIZED', message: 'Missing capture timestamp' }
  }
  const timestampSeconds = Number(input.timestampHeader)
  if (!Number.isFinite(timestampSeconds) || timestampSeconds <= 0) {
    return { ok: false, code: 'UNAUTHORIZED', message: 'Invalid capture timestamp' }
  }
  const tolerance = input.toleranceSeconds ?? ANALYTICS_CAPTURE_SIGNATURE_TOLERANCE_SECONDS
  const now = input.nowMs ?? Date.now()
  if (Math.abs(now - timestampSeconds * 1000) > tolerance * 1000) {
    return { ok: false, code: 'UNAUTHORIZED', message: 'Capture timestamp outside tolerance' }
  }
  const signedPayload = `${timestampSeconds}.${input.rawBody}`
  const expected = createHmac('sha256', input.secret).update(signedPayload).digest('hex')
  const provided = input.signatureHeader.replace(/^sha256=/, '')
  try {
    const a = Buffer.from(expected)
    const b = Buffer.from(provided)
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false, code: 'UNAUTHORIZED', message: 'Invalid capture signature' }
    }
  } catch {
    return { ok: false, code: 'UNAUTHORIZED', message: 'Invalid capture signature' }
  }
  return { ok: true, timestampSeconds }
}

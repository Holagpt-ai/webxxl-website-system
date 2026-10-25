import { ANALYTICS_CAPTURE_RATE_LIMIT_PER_MINUTE } from '@/config/analytics-backend'

type Bucket = { windowStartMs: number; count: number }

const buckets = new Map<string, Bucket>()

export function resetCaptureRateLimitsForTests(): void {
  buckets.clear()
}

export function checkCaptureRateLimit(input: {
  publicKeyId: string
  limitPerMinute?: number
  nowMs?: number
}): { ok: true } | { ok: false; code: 'RATE_LIMIT'; message: string } {
  const limit = input.limitPerMinute ?? ANALYTICS_CAPTURE_RATE_LIMIT_PER_MINUTE
  const now = input.nowMs ?? Date.now()
  const windowMs = 60_000
  const windowStart = Math.floor(now / windowMs) * windowMs
  const key = `${input.publicKeyId}:${windowStart}`
  const existing = buckets.get(key)
  if (!existing) {
    buckets.set(key, { windowStartMs: windowStart, count: 1 })
    return { ok: true }
  }
  if (existing.count >= limit) {
    return { ok: false, code: 'RATE_LIMIT', message: 'Capture rate limit exceeded' }
  }
  existing.count += 1
  return { ok: true }
}

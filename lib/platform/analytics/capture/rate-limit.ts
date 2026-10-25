import { prisma } from '@/lib/db'
import { ANALYTICS_CAPTURE_RATE_LIMIT_PER_MINUTE } from '@/config/analytics-backend'

const WINDOW_MS = 60_000
const TTL_MS = 2 * WINDOW_MS

function windowStartUtc(nowMs: number): Date {
  const bucket = Math.floor(nowMs / WINDOW_MS) * WINDOW_MS
  return new Date(bucket)
}

export type CaptureRateLimitResult = { ok: true } | { ok: false; code: 'RATE_LIMIT'; message: string }

/**
 * PostgreSQL-backed sliding minute window — effective across serverless instances.
 */
export async function checkCaptureRateLimit(input: {
  publicKeyId: string
  limitPerMinute?: number
  nowMs?: number
}): Promise<CaptureRateLimitResult> {
  const limit = input.limitPerMinute ?? ANALYTICS_CAPTURE_RATE_LIMIT_PER_MINUTE
  const now = input.nowMs ?? Date.now()
  const windowStart = windowStartUtc(now)
  const expiresAt = new Date(windowStart.getTime() + TTL_MS)

  const rows = await prisma.$queryRaw<{ requestCount: number }[]>`
    INSERT INTO "AnalyticsCaptureRateWindow" ("publicKeyId", "windowStart", "requestCount", "expiresAt")
    VALUES (${input.publicKeyId}, ${windowStart}, 1, ${expiresAt})
    ON CONFLICT ("publicKeyId", "windowStart")
    DO UPDATE SET "requestCount" = "AnalyticsCaptureRateWindow"."requestCount" + 1
    RETURNING "requestCount"
  `
  const count = rows[0]?.requestCount ?? 1
  if (count > limit) {
    return { ok: false, code: 'RATE_LIMIT', message: 'Capture rate limit exceeded' }
  }
  return { ok: true }
}

/** Test-only: trim expired windows (production cleanup may use a scheduled job later). */
export async function purgeExpiredCaptureRateWindows(nowMs?: number): Promise<number> {
  const now = new Date(nowMs ?? Date.now())
  const result = await prisma.analyticsCaptureRateWindow.deleteMany({
    where: { expiresAt: { lt: now } },
  })
  return result.count
}

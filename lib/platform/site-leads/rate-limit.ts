import { prisma } from '@/lib/db'
import { SITE_LEAD_INTAKE_RATE_LIMIT_PER_MINUTE } from '@/config/site-lead-intake'

const WINDOW_MS = 60_000
const TTL_MS = 2 * WINDOW_MS

function windowStartUtc(nowMs: number): Date {
  const bucket = Math.floor(nowMs / WINDOW_MS) * WINDOW_MS
  return new Date(bucket)
}

export type SiteLeadRateLimitResult = { ok: true } | { ok: false; code: 'RATE_LIMIT'; message: string }

export async function checkSiteLeadIntakeRateLimit(input: {
  publicKeyId: string
  limitPerMinute?: number
  nowMs?: number
}): Promise<SiteLeadRateLimitResult> {
  const limit = input.limitPerMinute ?? SITE_LEAD_INTAKE_RATE_LIMIT_PER_MINUTE
  const now = input.nowMs ?? Date.now()
  const windowStart = windowStartUtc(now)
  const expiresAt = new Date(windowStart.getTime() + TTL_MS)

  const rows = await prisma.$queryRaw<{ requestCount: number }[]>`
    INSERT INTO "ManagedSiteLeadIntakeRateWindow" ("publicKeyId", "windowStart", "requestCount", "expiresAt")
    VALUES (${input.publicKeyId}, ${windowStart}, 1, ${expiresAt})
    ON CONFLICT ("publicKeyId", "windowStart")
    DO UPDATE SET "requestCount" = "ManagedSiteLeadIntakeRateWindow"."requestCount" + 1
    RETURNING "requestCount"
  `
  const count = rows[0]?.requestCount ?? 1
  if (count > limit) {
    return { ok: false, code: 'RATE_LIMIT', message: 'Lead intake rate limit exceeded' }
  }
  return { ok: true }
}

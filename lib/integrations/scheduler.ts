/**
 * INTEGRATION BOUNDARY — Social scheduler (Postiz).
 * The scheduler runs as a separate app at app.webbxxl.com; the main site
 * never embeds it. This module is the single place that knows the scheduler's
 * URL and how to talk to its API.
 *
 * v1: live status checks (no auth needed). When platform approvals land,
 * add POSTIZ_API_TOKEN and the account/stats readers below become live.
 */

export const schedulerUrl =
  process.env.NEXT_PUBLIC_SCHEDULER_URL || 'https://app.webbxxl.com'

export const isSchedulerConfigured = Boolean(
  process.env.NEXT_PUBLIC_SCHEDULER_URL || true,
)

export type SchedulerStatus =
  | { ok: true; latencyMs: number }
  | { ok: false; reason: 'unreachable' | 'error'; latencyMs: number }

/** Live health check against the scheduler app. Safe to call from server components. */
export async function getSchedulerStatus(): Promise<SchedulerStatus> {
  const started = Date.now()
  try {
    const res = await fetch(`${schedulerUrl}/`, {
      method: 'HEAD',
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    })
    const latencyMs = Date.now() - started
    if (res.ok || res.status === 405) return { ok: true, latencyMs }
    return { ok: false, reason: 'error', latencyMs }
  } catch {
    return { ok: false, reason: 'unreachable', latencyMs: Date.now() - started }
  }
}

/** Where the "Open scheduler" button goes. */
export function getSchedulerLaunchUrl(): string {
  return schedulerUrl
}

/* ------------------------------------------------------------------ */
/* Postiz API (phase 2 — needs POSTIZ_API_TOKEN once approvals land)   */
/* ------------------------------------------------------------------ */

export type SchedulerChannel = {
  platform: 'tiktok' | 'instagram' | 'youtube' | 'facebook' | 'x' | 'linkedin'
  connected: boolean
  accountName?: string
}

export type SchedulerStats = {
  scheduledCount: number
  publishedThisWeek: number
  channels: SchedulerChannel[]
}

const apiToken = process.env.POSTIZ_API_TOKEN

export async function getSchedulerStats(): Promise<SchedulerStats | null> {
  if (!apiToken) return null
  // TODO: wire to the Postiz REST API (Swagger at /api/docs) once the
  // platform apps are approved and a token is issued.
  return null
}

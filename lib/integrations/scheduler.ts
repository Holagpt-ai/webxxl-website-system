/**
 * INTEGRATION BOUNDARY — Social scheduler (Postiz).
 * Scheduler runs at app.webbxxl.com; the main site links out (no iframe).
 */

export const schedulerUrl = process.env.NEXT_PUBLIC_SCHEDULER_URL || 'https://app.webbxxl.com'

export type SchedulerStatus =
  | { ok: true; latencyMs: number }
  | { ok: false; reason: 'unreachable' | 'error'; latencyMs: number }

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

export function getSchedulerLaunchUrl(): string {
  return schedulerUrl
}

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
  return null
}

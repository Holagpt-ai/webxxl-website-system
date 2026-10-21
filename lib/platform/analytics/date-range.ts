import { ANALYTICS_MAX_DATE_RANGE_DAYS } from '@/config/analytics-backend'
import type { AnalyticsResult } from '@/lib/platform/analytics/types'

export type AnalyticsDateRange = {
  start: Date
  end: Date
  startIso: string
  endIso: string
}

function parseDay(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const d = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(d.getTime())) return null
  return d
}

export function parseAnalyticsDateRange(
  searchParams: URLSearchParams,
  now = new Date(),
): AnalyticsResult<AnalyticsDateRange> {
  const endRaw = searchParams.get('end') ?? now.toISOString().slice(0, 10)
  const startRaw = searchParams.get('start')
  const end = parseDay(endRaw)
  if (!end) return { ok: false, error: 'VALIDATION', message: 'Invalid end date (YYYY-MM-DD)' }
  const defaultStart = new Date(end)
  defaultStart.setUTCDate(defaultStart.getUTCDate() - 27)
  const start = startRaw ? parseDay(startRaw) : defaultStart
  if (!start) return { ok: false, error: 'VALIDATION', message: 'Invalid start date (YYYY-MM-DD)' }
  if (start.getTime() > end.getTime()) {
    return { ok: false, error: 'VALIDATION', message: 'start must be on or before end' }
  }
  const spanDays = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1
  if (spanDays > ANALYTICS_MAX_DATE_RANGE_DAYS) {
    return {
      ok: false,
      error: 'VALIDATION',
      message: `Date range exceeds ${ANALYTICS_MAX_DATE_RANGE_DAYS} days`,
    }
  }
  return {
    ok: true,
    value: {
      start,
      end,
      startIso: start.toISOString().slice(0, 10),
      endIso: end.toISOString().slice(0, 10),
    },
  }
}

export function previousPeriod(range: AnalyticsDateRange): AnalyticsDateRange {
  const spanMs = range.end.getTime() - range.start.getTime() + 86_400_000
  const prevEnd = new Date(range.start.getTime() - 86_400_000)
  const prevStart = new Date(prevEnd.getTime() - spanMs + 86_400_000)
  return {
    start: prevStart,
    end: prevEnd,
    startIso: prevStart.toISOString().slice(0, 10),
    endIso: prevEnd.toISOString().slice(0, 10),
  }
}

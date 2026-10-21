/** Mirrors the backend default `ANALYTICS_MAX_DATE_RANGE_DAYS`; the API remains the final validator. */
export const MAX_RANGE_DAYS = 366

export const RANGE_PRESETS = [7, 28, 90, 365] as const
export type RangePreset = (typeof RANGE_PRESETS)[number]

const DAY_MS = 86_400_000
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

export function todayUtc(now = new Date()) {
  return now.toISOString().slice(0, 10)
}

function parseUtcDay(value: string) {
  if (!ISO_DAY.test(value)) return null
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

export function presetRange(days: RangePreset, now = new Date()) {
  const end = todayUtc(now)
  const start = new Date(parseUtcDay(end)!.getTime() - (days - 1) * DAY_MS).toISOString().slice(0, 10)
  return { start, end }
}

export function spanDays(start: string, end: string) {
  const s = parseUtcDay(start)
  const e = parseUtcDay(end)
  if (!s || !e) return null
  return Math.floor((e.getTime() - s.getTime()) / DAY_MS) + 1
}

export type RangeIssue = 'INVALID' | 'ORDER' | 'TOO_LONG' | 'FUTURE'

export function validateRange(start: string, end: string, now = new Date()): RangeIssue | null {
  const s = parseUtcDay(start)
  const e = parseUtcDay(end)
  if (!s || !e) return 'INVALID'
  if (s.getTime() > e.getTime()) return 'ORDER'
  if (end > todayUtc(now)) return 'FUTURE'
  if ((spanDays(start, end) ?? 0) > MAX_RANGE_DAYS) return 'TOO_LONG'
  return null
}

/** Formats a `YYYY-MM-DD` day in UTC so no local timezone shift is applied. */
export function formatUtcDay(day: string, locale: string, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }) {
  const date = parseUtcDay(day.slice(0, 10))
  if (!date) return day
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-US' : 'en-US', { ...opts, timeZone: 'UTC' }).format(date)
}

export function formatUtcTimestamp(iso: string, locale: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-US' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
  }).format(date)
}

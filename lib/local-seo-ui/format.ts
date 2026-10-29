import { DASH } from '@/lib/crm-ui/workspace'

/** GSC dates are calendar days (YYYY-MM-DD). Format them in UTC so they never shift a day by time zone. */
export function formatDay(day: string | null | undefined, locale: string): string {
  if (!day) return DASH
  const date = new Date(`${day.slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return DASH
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(date)
}

export function formatDayRange(range: { start: string; end: string } | undefined, locale: string): string {
  if (!range) return DASH
  return `${formatDay(range.start, locale)} – ${formatDay(range.end, locale)}`
}

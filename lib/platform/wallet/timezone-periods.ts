type ZonedParts = { year: number; month: number; day: number; hour: number; minute: number; second: number }

export function isSupportedPolicyTimezone(timeZone: string): boolean {
  if (timeZone === 'UTC') return true
  try {
    Intl.DateTimeFormat('en-US', { timeZone }).format(new Date())
    return true
  } catch {
    return false
  }
}

function zonedDateTimeParts(at: Date, timeZone: string): ZonedParts | null {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
    const parts = formatter.formatToParts(at)
    const read = (type: string) => Number(parts.find((p) => p.type === type)?.value)
    const year = read('year')
    const month = read('month')
    const day = read('day')
    const hour = read('hour')
    const minute = read('minute')
    const second = read('second')
    if (
      ![year, month, day, hour, minute, second].every((n) => Number.isFinite(n))
    ) {
      return null
    }
    return { year, month, day, hour, minute, second }
  } catch {
    return null
  }
}

/** UTC instant for local calendar date at 00:00:00 in the given IANA timezone. */
export function utcInstantForZonedMidnight(
  year: number,
  month: number,
  day: number,
  timeZone: string,
): Date | null {
  if (timeZone === 'UTC') {
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
  }
  if (!isSupportedPolicyTimezone(timeZone)) return null

  const anchor = Date.UTC(year, month - 1, day, 12, 0, 0, 0)
  let candidate: number | null = null
  for (let t = anchor - 36 * 3_600_000; t <= anchor + 36 * 3_600_000; t += 3_600_000) {
    const p = zonedDateTimeParts(new Date(t), timeZone)
    if (!p) return null
    if (p.year === year && p.month === month && p.day === day && p.hour === 0 && p.minute === 0) {
      candidate = t
      break
    }
  }
  if (candidate === null) return null

  let best = candidate
  for (let t = candidate - 3_600_000; t <= candidate + 3_600_000; t += 60_000) {
    const p = zonedDateTimeParts(new Date(t), timeZone)
    if (!p) continue
    if (p.year === year && p.month === month && p.day === day && p.hour === 0 && p.minute === 0 && p.second === 0) {
      if (t < best) best = t
    }
  }
  return new Date(best)
}

export function zonedDateParts(at: Date, timeZone: string): { year: number; month: number; day: number } | null {
  const p = zonedDateTimeParts(at, timeZone)
  if (!p) return null
  return { year: p.year, month: p.month, day: p.day }
}

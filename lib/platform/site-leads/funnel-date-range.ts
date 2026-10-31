import { SITE_LEAD_FUNNEL_MAX_RANGE_DAYS } from '@/config/site-lead-intake'

export type SiteLeadFunnelDateRange = {
  createdFrom: Date
  createdToExclusive: Date
  createdFromIso: string
  createdToInclusiveIso: string
}

export function parseSiteLeadFunnelDateRange(input: {
  createdFromRaw: string | null
  createdToRaw: string | null
  now?: Date
}): { ok: true; value: SiteLeadFunnelDateRange } | { ok: false; message: string } {
  const now = input.now ?? new Date()
  const defaultTo = startOfUtcDay(now)
  const defaultFrom = new Date(defaultTo)
  defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 30)

  const fromParsed = input.createdFromRaw
    ? parseIsoDate(input.createdFromRaw, 'createdFrom')
    : ({ ok: true as const, value: defaultFrom })
  if (!fromParsed.ok) return fromParsed
  const toParsed = input.createdToRaw
    ? parseIsoDate(input.createdToRaw, 'createdTo')
    : ({ ok: true as const, value: defaultTo })
  if (!toParsed.ok) return toParsed

  if (fromParsed.value.getTime() > toParsed.value.getTime()) {
    return { ok: false, message: 'createdFrom must be on or before createdTo' }
  }

  const createdToExclusive = new Date(toParsed.value)
  createdToExclusive.setUTCDate(createdToExclusive.getUTCDate() + 1)

  const spanDays =
    (createdToExclusive.getTime() - fromParsed.value.getTime()) / (24 * 60 * 60 * 1000)
  if (spanDays > SITE_LEAD_FUNNEL_MAX_RANGE_DAYS + 1) {
    return {
      ok: false,
      message: `Date range must not exceed ${SITE_LEAD_FUNNEL_MAX_RANGE_DAYS} days`,
    }
  }

  return {
    ok: true,
    value: {
      createdFrom: fromParsed.value,
      createdToExclusive,
      createdFromIso: fromParsed.value.toISOString().slice(0, 10),
      createdToInclusiveIso: toParsed.value.toISOString().slice(0, 10),
    },
  }
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

function parseIsoDate(
  raw: string,
  field: string,
): { ok: true; value: Date } | { ok: false; message: string } {
  const trimmed = raw.trim()
  if (!trimmed) return { ok: false, message: `${field} is required when provided` }
  const parsed = new Date(trimmed.length === 10 ? `${trimmed}T00:00:00.000Z` : trimmed)
  if (Number.isNaN(parsed.getTime())) {
    return { ok: false, message: `${field} is invalid` }
  }
  return { ok: true, value: startOfUtcDay(parsed) }
}

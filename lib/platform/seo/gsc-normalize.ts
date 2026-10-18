import type {
  GscNormalizedReport,
  GscNormalizedRow,
  GscSearchAnalyticsRequest,
  GscSearchAnalyticsResponse,
} from '@/lib/platform/seo/gsc-types'

const METRIC_SEMANTICS = {
  positionIsAverage: true as const,
  ctrIsRatio: true as const,
  missingRowIsNotZero: true as const,
}

export function normalizeGscSearchAnalyticsResponse(input: {
  propertyRef: string
  request: GscSearchAnalyticsRequest
  response: GscSearchAnalyticsResponse
  observedAt: Date
}): GscNormalizedReport {
  const dimensions = input.request.dimensions ?? []
  const rows: GscNormalizedRow[] = []
  for (const row of input.response.rows ?? []) {
    const mapped: GscNormalizedRow = {
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      averagePosition: row.position,
      metricSemantics: METRIC_SEMANTICS,
    }
    row.keys.forEach((key, index) => {
      const dim = dimensions[index]
      if (dim === 'query') mapped.query = key
      if (dim === 'page') mapped.page = key
      if (dim === 'country') mapped.country = key
      if (dim === 'device') mapped.device = key
      if (dim === 'date') mapped.date = key
    })
    rows.push(mapped)
  }
  return {
    propertyRef: input.propertyRef,
    startDate: input.request.startDate,
    endDate: input.request.endDate,
    rows,
    dataState: rows.length ? 'READY' : 'PARTIAL',
    sourceCompleteness: {
      rowCount: rows.length,
      aggregationType: input.response.responseAggregationType,
    },
    observedAt: input.observedAt.toISOString(),
  }
}

/** Weighted average position across rows with impressions; skips zero-impression rows. */
export function aggregateGscAveragePosition(rows: GscNormalizedRow[]): number | null {
  let weighted = 0
  let impressions = 0
  for (const row of rows) {
    if (row.averagePosition == null || row.impressions == null || row.impressions <= 0) continue
    weighted += row.averagePosition * row.impressions
    impressions += row.impressions
  }
  if (impressions === 0) return null
  return weighted / impressions
}

/** Sum clicks/impressions; CTR recomputed as ratio when possible — never average CTR across rows. */
export function aggregateGscTraffic(rows: GscNormalizedRow[]): {
  clicks: number | null
  impressions: number | null
  ctr: number | null
} {
  let clicks = 0
  let impressions = 0
  let hasAny = false
  for (const row of rows) {
    if (row.clicks != null) {
      clicks += row.clicks
      hasAny = true
    }
    if (row.impressions != null) {
      impressions += row.impressions
      hasAny = true
    }
  }
  if (!hasAny) return { clicks: null, impressions: null, ctr: null }
  const ctr = impressions > 0 ? clicks / impressions : null
  return { clicks, impressions, ctr }
}

/** Do not invent zero rows for missing calendar days. */
export function fillMissingGscDays(_start: string, _end: string, rows: GscNormalizedRow[]): GscNormalizedRow[] {
  return rows
}

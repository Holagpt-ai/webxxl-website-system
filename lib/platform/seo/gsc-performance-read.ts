import { aggregateGscAveragePosition, aggregateGscTraffic } from '@/lib/platform/seo/gsc-normalize'
import type { GscNormalizedRow } from '@/lib/platform/seo/gsc-types'
import type { SeoFreshnessState } from '@/lib/platform/seo/types'

export type PersistedKeywordRow = {
  idempotencyKey: string
  query: string
  page: string | null
  clicks: number | null
  impressions: number | null
  ctr: number | null
  averagePosition: number | null
  date: Date
  dataState: string
}

export type GscPerformanceReadModel = {
  dataState: SeoFreshnessState
  propertyRef?: string
  dateRange?: { start: string; end: string }
  asOf?: string
  clicks: number | null
  impressions: number | null
  ctr: number | null
  averagePosition: number | null
  averagePositionLabel: 'GSC average position (not fixed rank)'
  completeness: {
    rowCount: number
    dedupedRowCount: number
    distinctDates: number
    aggregationMethod: 'query_page_date_deduped_sum'
    limitations: string[]
  }
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Aggregate one compatible window: dedupe by idempotency key, sum query×page×day rows only. */
export function buildGscPerformanceFromObservations(input: {
  connectionDataState: string
  propertyRef: string
  rows: PersistedKeywordRow[]
  snapshot?: { start: string; end: string; observedAt: string; rowCount?: number; methodologyVersion?: string } | null
  /** When true and no snapshot metadata, do not aggregate historical keyword rows. */
  requireVerifiedSnapshotWindow?: boolean
}): GscPerformanceReadModel {
  if (input.requireVerifiedSnapshotWindow && !input.snapshot) {
    return {
      dataState: 'PARTIAL',
      propertyRef: input.propertyRef,
      averagePositionLabel: 'GSC average position (not fixed rank)',
      clicks: null,
      impressions: null,
      ctr: null,
      averagePosition: null,
      completeness: {
        rowCount: 0,
        dedupedRowCount: 0,
        distinctDates: 0,
        aggregationMethod: 'query_page_date_deduped_sum',
        limitations: [
          'No verified GSC snapshot window for this property; historical observations are not aggregated',
        ],
      },
    }
  }
  const base: GscPerformanceReadModel = {
    dataState: 'NOT_CONNECTED',
    averagePositionLabel: 'GSC average position (not fixed rank)',
    clicks: null,
    impressions: null,
    ctr: null,
    averagePosition: null,
    completeness: {
      rowCount: input.rows.length,
      dedupedRowCount: 0,
      distinctDates: 0,
      aggregationMethod: 'query_page_date_deduped_sum',
      limitations: [],
    },
  }

  if (input.connectionDataState === 'NOT_CONNECTED') return base

  const byMetricKey = new Map<string, PersistedKeywordRow>()
  for (const row of input.rows) {
    const metricKey = `${row.query}|${row.page ?? ''}|${toIsoDate(row.date)}`
    if (!byMetricKey.has(metricKey)) byMetricKey.set(metricKey, row)
  }
  const uniqueRows = [...byMetricKey.values()]
  if (uniqueRows.length === 0) {
    return {
      ...base,
      dataState: input.connectionDataState === 'READY' ? 'PARTIAL' : (input.connectionDataState as SeoFreshnessState),
      propertyRef: input.propertyRef,
      completeness: {
        ...base.completeness,
        dedupedRowCount: 0,
        limitations: ['No persisted GSC keyword observations for selected window'],
      },
    }
  }

  const dates = new Set(uniqueRows.map((r) => toIsoDate(r.date)))
  let minDate = uniqueRows[0]!.date
  let maxDate = uniqueRows[0]!.date
  for (const row of uniqueRows) {
    if (row.date < minDate) minDate = row.date
    if (row.date > maxDate) maxDate = row.date
  }

  const normalized: GscNormalizedRow[] = uniqueRows.map((k) => ({
    query: k.query,
    page: k.page ?? undefined,
    date: toIsoDate(k.date),
    clicks: k.clicks,
    impressions: k.impressions,
    ctr: k.ctr,
    averagePosition: k.averagePosition,
    metricSemantics: {
      positionIsAverage: true,
      ctrIsRatio: true,
      missingRowIsNotZero: true,
    },
  }))

  const traffic = aggregateGscTraffic(normalized)
  const limitations: string[] = []
  if (input.snapshot && (input.snapshot.start !== toIsoDate(minDate) || input.snapshot.end !== toIsoDate(maxDate))) {
    limitations.push('Persisted rows span a different window than latest snapshot metadata')
  }
  if (uniqueRows.some((r) => r.dataState === 'PARTIAL' || r.dataState === 'STALE')) {
    limitations.push('Some rows marked partial or stale')
  }
  limitations.push('Totals sum query×page×day rows; not site-wide if dimensions overlap or historical snapshots mixed')

  return {
    dataState: input.connectionDataState as SeoFreshnessState,
    propertyRef: input.propertyRef,
    dateRange: input.snapshot
      ? { start: input.snapshot.start, end: input.snapshot.end }
      : { start: toIsoDate(minDate), end: toIsoDate(maxDate) },
    asOf: input.snapshot?.observedAt ?? new Date().toISOString(),
    ...traffic,
    averagePosition: aggregateGscAveragePosition(normalized),
    averagePositionLabel: 'GSC average position (not fixed rank)',
    completeness: {
      rowCount: input.rows.length,
      dedupedRowCount: uniqueRows.length,
      distinctDates: dates.size,
      aggregationMethod: 'query_page_date_deduped_sum',
      limitations,
    },
  }
}

/** Rows sharing query×page×date but different idempotency keys must not be double-counted. */
export function countOverlappingMetricKeys(rows: PersistedKeywordRow[]): number {
  const byMetric = new Map<string, Set<string>>()
  let overlaps = 0
  for (const row of rows) {
    const key = `${row.query}|${row.page ?? ''}|${toIsoDate(row.date)}`
    const ids = byMetric.get(key) ?? new Set<string>()
    ids.add(row.idempotencyKey)
    byMetric.set(key, ids)
    if (ids.size > 1) overlaps += 1
  }
  return overlaps
}

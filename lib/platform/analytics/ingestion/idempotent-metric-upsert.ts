import { buildSeoMetricIdempotencyKey } from '@/lib/platform/seo/ingest-idempotency'

export type MetricUpsertRow = {
  managedSiteId: string
  customerAccountId: string
  provider: string
  metricDefinition: string
  dimension?: string | null
  dimensionValue?: string | null
  value: number | null
  dataState: string
  date?: Date | null
  observedAt: Date
}

export function metricUpsertIdempotencyKey(row: MetricUpsertRow): string {
  return buildSeoMetricIdempotencyKey({
    managedSiteId: row.managedSiteId,
    provider: row.provider,
    metricDefinition: row.metricDefinition,
    dimension: row.dimension,
    dimensionValue: row.dimensionValue,
    date: row.date ? row.date.toISOString().slice(0, 10) : null,
  })
}

/** Pure helper: detect duplicate keys in a batch before persistence. */
export function findDuplicateMetricKeys(rows: MetricUpsertRow[]): string[] {
  const seen = new Set<string>()
  const dupes: string[] = []
  for (const row of rows) {
    const key = metricUpsertIdempotencyKey(row)
    if (seen.has(key)) dupes.push(key)
    seen.add(key)
  }
  return dupes
}

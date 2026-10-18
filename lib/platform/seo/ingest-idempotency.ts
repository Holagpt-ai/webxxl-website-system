export function buildSeoMetricIdempotencyKey(input: {
  managedSiteId: string
  provider: string
  metricDefinition: string
  dimension?: string | null
  dimensionValue?: string | null
  date?: string | null
}): string {
  return [
    input.managedSiteId,
    input.provider,
    input.metricDefinition,
    input.dimension ?? '-',
    input.dimensionValue ?? '-',
    input.date ?? '-',
  ].join(':')
}

export function buildSeoKeywordIdempotencyKey(input: {
  managedSiteId: string
  provider: string
  query: string
  page?: string | null
  date: string
}): string {
  return [input.managedSiteId, input.provider, input.query, input.page ?? '-', input.date].join(':')
}

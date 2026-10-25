export function nextAnalyticsPublicId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10)
  return `${prefix}_${Date.now().toString(36)}_${rand}`
}

export function buildConversionObservationIdempotencyKey(input: {
  managedSiteId: string
  conversionKey: string
  periodDate: string
  sourceProvider: string
}): string {
  return [input.managedSiteId, input.sourceProvider, input.conversionKey, input.periodDate].join(':')
}

export function buildWebxxlEventIdempotencyKey(input: {
  customerAccountId: string
  managedSiteId: string
  eventKey: string
  idempotencySeed: string
}): string {
  return [input.customerAccountId, input.managedSiteId, input.eventKey, input.idempotencySeed].join(':')
}

export function buildAnalyticsProviderSyncJobIdempotencyKey(input: {
  managedSiteId: string
  provider: string
  periodDate: string
}): string {
  return ['analytics-sync', input.managedSiteId, input.provider, input.periodDate].join(':')
}

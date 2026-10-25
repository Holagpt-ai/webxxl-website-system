function envFlag(name: string, defaultValue = false): boolean {
  const raw = process.env[name]
  if (raw === undefined) return defaultValue
  return raw === '1' || raw.toLowerCase() === 'true'
}

/** Customer analytics & BI HTTP layer. Default off (see also features.analyticsBackend). */
export function isAnalyticsBackendEnabled(): boolean {
  return envFlag('ANALYTICS_BACKEND_ENABLED', false)
}

/** Scheduled / worker-triggered provider ingestion for analytics. Default off. */
export function isAnalyticsIngestionEnabled(): boolean {
  return envFlag('ANALYTICS_INGESTION_ENABLED', false)
}

/** First-party WebXXL conversion event capture API. Default off. */
export function isAnalyticsFirstPartyCaptureEnabled(): boolean {
  return envFlag('ANALYTICS_FIRST_PARTY_CAPTURE_ENABLED', false)
}

/** Live provider HTTP fetch during ingestion jobs. Default off even when ingestion worker is enabled. */
export function isAnalyticsProviderFetchEnabled(): boolean {
  return envFlag('ANALYTICS_PROVIDER_FETCH_ENABLED', false)
}

/** GSC HTTP transport for analytics ingestion (separate from fetch gate). Default off — no live Google in Batch 15. */
export function isAnalyticsGscLiveTransportEnabled(): boolean {
  return envFlag('ANALYTICS_GSC_LIVE_TRANSPORT_ENABLED', false)
}

export const ANALYTICS_MAX_DATE_RANGE_DAYS = Number(process.env.ANALYTICS_MAX_DATE_RANGE_DAYS ?? '366')
export const ANALYTICS_DEFAULT_TIMEZONE = process.env.ANALYTICS_DEFAULT_TIMEZONE ?? 'UTC'
export const ANALYTICS_CAPTURE_MAX_BODY_BYTES = Number(process.env.ANALYTICS_CAPTURE_MAX_BODY_BYTES ?? '8192')
export const ANALYTICS_CAPTURE_SIGNATURE_TOLERANCE_SECONDS = Number(
  process.env.ANALYTICS_CAPTURE_SIGNATURE_TOLERANCE_SECONDS ?? '300',
)
export const ANALYTICS_CAPTURE_RATE_LIMIT_PER_MINUTE = Number(process.env.ANALYTICS_CAPTURE_RATE_LIMIT_PER_MINUTE ?? '120')
export const ANALYTICS_INGESTION_MAX_BACKFILL_DAYS = Number(process.env.ANALYTICS_INGESTION_MAX_BACKFILL_DAYS ?? '7')

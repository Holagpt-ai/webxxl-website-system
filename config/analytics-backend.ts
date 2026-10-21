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

export const ANALYTICS_MAX_DATE_RANGE_DAYS = Number(process.env.ANALYTICS_MAX_DATE_RANGE_DAYS ?? '366')
export const ANALYTICS_DEFAULT_TIMEZONE = process.env.ANALYTICS_DEFAULT_TIMEZONE ?? 'UTC'

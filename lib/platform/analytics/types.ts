export type AnalyticsError =
  | 'ANALYTICS_DISABLED'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'TENANT_MISMATCH'
  | 'VALIDATION'
  | 'ENTITLEMENT_UNRESOLVED'
  | 'NOT_FOUND'
  | 'PROVIDER_UNAVAILABLE'
  | 'UNKNOWN'

export type AnalyticsResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: AnalyticsError; message?: string }

export type AnalyticsActor = {
  userId: string
  platformRole: string
}

export type AnalyticsFreshnessState =
  | 'NOT_CONNECTED'
  | 'PENDING'
  | 'READY'
  | 'PARTIAL'
  | 'STALE'
  | 'ERROR'
  | 'NOT_SUPPORTED'

export type AnalyticsProviderKey = 'GA4' | 'GSC' | 'GBP' | 'RANK_VENDOR' | 'WEBXXL_EVENTS'

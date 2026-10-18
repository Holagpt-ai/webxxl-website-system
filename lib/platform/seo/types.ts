export type SeoResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: SeoErrorCode; message: string }

export type SeoErrorCode =
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'CONFLICT'
  | 'VALIDATION'
  | 'NOT_CONFIGURED'
  | 'POLICY_UNRESOLVED'
  | 'SEO_DISABLED'
  | 'CRAWL_BLOCKED'

export type SeoFreshnessState =
  | 'NOT_CONNECTED'
  | 'FETCHING'
  | 'READY'
  | 'PARTIAL'
  | 'STALE'
  | 'ERROR'
  | 'NOT_SUPPORTED'

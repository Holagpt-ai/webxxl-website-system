'use client'

import useSWR from 'swr'
import type {
  AnalyticsAcquisitionRowDto,
  AnalyticsConversionSummaryRowDto,
  AnalyticsCrmRelationshipDto,
  AnalyticsLocalPerformanceDto,
  AnalyticsOverviewDto,
  AnalyticsPeriodChangeDto,
  AnalyticsPropertyConnectionDto,
  AnalyticsSearchPerformanceDto,
  AnalyticsSourceFreshnessDto,
  AnalyticsSyncRunDto,
  AnalyticsSyncStatusDto,
  AnalyticsTrafficSeriesPointDto,
  AnalyticsTrendSeriesDto,
} from '@/lib/platform/analytics/dto'
import type { AnalyticsFreshnessState, AnalyticsProviderKey } from '@/lib/platform/analytics/types'

export type {
  AnalyticsAcquisitionRowDto,
  AnalyticsConversionSummaryRowDto,
  AnalyticsCrmRelationshipDto,
  AnalyticsLocalPerformanceDto,
  AnalyticsOverviewDto,
  AnalyticsPeriodChangeDto,
  AnalyticsPropertyConnectionDto,
  AnalyticsSearchPerformanceDto,
  AnalyticsSourceFreshnessDto,
  AnalyticsSyncRunDto,
  AnalyticsSyncStatusDto,
  AnalyticsTrafficSeriesPointDto,
  AnalyticsTrendSeriesDto,
  AnalyticsFreshnessState,
  AnalyticsProviderKey,
}

/** `GET /traffic` returns the overview traffic block verbatim. */
export type AnalyticsTrafficDto = AnalyticsOverviewDto['traffic']

/** Only these metrics produce trend points in BATCH-14 (`buildAnalyticsTrendSeries`). */
export const TREND_METRICS = ['ga4.sessions', 'ga4.activeUsers'] as const
export type TrendMetric = (typeof TREND_METRICS)[number]

export const ANALYTICS_ERROR_CODES = [
  'ANALYTICS_DISABLED',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'TENANT_MISMATCH',
  'VALIDATION',
  'ENTITLEMENT_UNRESOLVED',
  'NOT_FOUND',
  'PROVIDER_UNAVAILABLE',
  'UNKNOWN',
] as const

export type AnalyticsErrorCode = (typeof ANALYTICS_ERROR_CODES)[number]

export class AnalyticsApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: AnalyticsErrorCode,
    readonly detail?: string,
  ) {
    super(code)
  }
}

function normalizeCode(status: number, raw: unknown): AnalyticsErrorCode {
  if (typeof raw === 'string' && (ANALYTICS_ERROR_CODES as readonly string[]).includes(raw)) {
    return raw as AnalyticsErrorCode
  }
  if (status === 401) return 'UNAUTHORIZED'
  if (status === 403) return 'FORBIDDEN'
  if (status === 404) return 'NOT_FOUND'
  if (status === 400) return 'VALIDATION'
  if (status === 503) return 'ANALYTICS_DISABLED'
  return 'UNKNOWN'
}

async function analyticsFetcher<T>(url: string): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, { headers: { accept: 'application/json' }, credentials: 'same-origin' })
  } catch {
    throw new AnalyticsApiError(0, 'UNKNOWN')
  }
  if (!res.ok) {
    let body: { code?: unknown; message?: unknown } = {}
    try {
      body = await res.json()
    } catch {
      // Non-JSON error bodies fall back to status-based codes.
    }
    const detail = typeof body.message === 'string' && body.message !== body.code ? body.message : undefined
    throw new AnalyticsApiError(res.status, normalizeCode(res.status, body.code), detail)
  }
  return (await res.json()) as T
}

export type AnalyticsFilters = {
  start: string
  end: string
  siteId: string
}

type Endpoint = 'overview' | 'traffic' | 'search' | 'local' | 'conversions' | 'trends' | 'properties' | 'sync-status'

const RANGELESS: Endpoint[] = ['properties', 'sync-status']

export function analyticsUrl(
  accountId: string,
  endpoint: Endpoint,
  filters: AnalyticsFilters,
  extra?: Record<string, string>,
) {
  const params = new URLSearchParams()
  if (!RANGELESS.includes(endpoint)) {
    params.set('start', filters.start)
    params.set('end', filters.end)
  }
  if (filters.siteId) params.set('siteId', filters.siteId)
  for (const [key, value] of Object.entries(extra ?? {})) params.set(key, value)
  const qs = params.toString()
  return `/api/v1/analytics/accounts/${encodeURIComponent(accountId)}/${endpoint}${qs ? `?${qs}` : ''}`
}

function shouldRetry(error: unknown) {
  return !(error instanceof AnalyticsApiError) || error.code === 'UNKNOWN'
}

function useAnalytics<T>(key: string | null) {
  return useSWR<T, AnalyticsApiError>(key, analyticsFetcher<T>, {
    revalidateOnFocus: false,
    keepPreviousData: true,
    shouldRetryOnError: shouldRetry,
    errorRetryCount: 2,
  })
}

export function useAnalyticsOverview(accountId: string, filters: AnalyticsFilters, enabled = true) {
  return useAnalytics<AnalyticsOverviewDto>(enabled ? analyticsUrl(accountId, 'overview', filters) : null)
}

export function useAnalyticsTraffic(accountId: string, filters: AnalyticsFilters) {
  return useAnalytics<AnalyticsTrafficDto>(analyticsUrl(accountId, 'traffic', filters))
}

export function useAnalyticsTrend(accountId: string, filters: AnalyticsFilters, metric: TrendMetric, enabled = true) {
  return useAnalytics<AnalyticsTrendSeriesDto>(enabled ? analyticsUrl(accountId, 'trends', filters, { metric }) : null)
}

export function useAnalyticsSearch(accountId: string, filters: AnalyticsFilters) {
  return useAnalytics<AnalyticsSearchPerformanceDto>(analyticsUrl(accountId, 'search', filters))
}

export function useAnalyticsLocal(accountId: string, filters: AnalyticsFilters) {
  return useAnalytics<AnalyticsLocalPerformanceDto>(analyticsUrl(accountId, 'local', filters))
}

export function useAnalyticsConversions(accountId: string, filters: AnalyticsFilters) {
  return useAnalytics<AnalyticsConversionSummaryRowDto[]>(analyticsUrl(accountId, 'conversions', filters))
}

export function useAnalyticsProperties(accountId: string, filters: AnalyticsFilters, allSites: boolean) {
  return useAnalytics<AnalyticsPropertyConnectionDto[]>(
    analyticsUrl(accountId, 'properties', allSites ? { ...filters, siteId: '' } : filters),
  )
}

export function useAnalyticsSyncStatus(accountId: string, filters: AnalyticsFilters) {
  return useAnalytics<AnalyticsSyncStatusDto>(analyticsUrl(accountId, 'sync-status', filters))
}

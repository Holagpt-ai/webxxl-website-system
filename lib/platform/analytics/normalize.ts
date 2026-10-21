import type { AnalyticsFreshnessState } from '@/lib/platform/analytics/types'

export function mapSeoDataStateToFreshness(state: string): AnalyticsFreshnessState {
  switch (state) {
    case 'READY':
    case 'PARTIAL':
    case 'STALE':
    case 'ERROR':
    case 'FETCHING':
    case 'NOT_CONNECTED':
    case 'NOT_SUPPORTED':
      return state === 'FETCHING' ? 'PENDING' : (state as AnalyticsFreshnessState)
    default:
      return 'NOT_CONNECTED'
  }
}

export function sumMetricValues(
  rows: { value: number | null; dataState: string }[],
): { total: number | null; dataState: AnalyticsFreshnessState } {
  if (rows.length === 0) return { total: null, dataState: 'NOT_CONNECTED' }
  let total = 0
  let any = false
  let state: AnalyticsFreshnessState = 'READY'
  for (const row of rows) {
    if (row.value == null) continue
    any = true
    total += row.value
    const mapped = mapSeoDataStateToFreshness(row.dataState)
    if (mapped === 'ERROR' || mapped === 'STALE') state = mapped
    else if (mapped === 'PARTIAL' && state === 'READY') state = 'PARTIAL'
  }
  return { total: any ? total : null, dataState: any ? state : 'NOT_CONNECTED' }
}

export function conversionRate(count: number, sessions: number | null): number | null {
  if (sessions == null || sessions <= 0) return null
  return count / sessions
}

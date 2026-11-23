import type { AnalyticsDateRange } from '@/lib/platform/analytics/date-range'
import { conversionRate } from '@/lib/platform/analytics/normalize'
import type { AnalyticsFreshnessState } from '@/lib/platform/analytics/types'
import type { AnalyticsStore } from '@/lib/platform/analytics/store'

export type AnalyticsConversionDailyPoint = {
  periodDate: string
  count: number
  uniqueCount: number
  dataState: AnalyticsFreshnessState
  provenance: 'STORED_CONVERSION_AGGREGATE'
  sourceProvider: string
  measuredAt: string
  idempotencyKey: string
}

export type AnalyticsConversionDetailDto = {
  conversionKey: string
  displayName: string
  managedSiteId: string
  timezone: string
  limitations: string[]
  summary: {
    count: number
    uniqueCount: number
    rate: number | null
    dataState: AnalyticsFreshnessState
    sessionsKnown: boolean
  }
  daily: AnalyticsConversionDailyPoint[]
}

export async function buildAnalyticsConversionDetail(
  store: AnalyticsStore,
  input: {
    customerAccountId: string
    managedSiteId: string
    conversionKey: string
    range: AnalyticsDateRange
    sessionsTotal: number | null
  },
): Promise<AnalyticsConversionDetailDto> {
  const [daily, defs] = await Promise.all([
    store.listConversionDaily({
      customerAccountId: input.customerAccountId,
      managedSiteId: input.managedSiteId,
      conversionKey: input.conversionKey,
      range: input.range,
    }),
    store.listConversionDefinitions(input.customerAccountId, input.managedSiteId),
  ])
  const def = defs.find((d) => d.key === input.conversionKey)
  const totalCount = daily.reduce((acc, row) => acc + row.count, 0)
  const totalUnique = daily.reduce((acc, row) => acc + row.uniqueCount, 0)
  const worstState = daily.reduce<AnalyticsFreshnessState>((state, row) => {
    if (state === 'ERROR' || row.dataState === 'ERROR') return 'ERROR'
    if (state === 'STALE' || row.dataState === 'STALE') return 'STALE'
    if (state === 'PARTIAL' || row.dataState === 'PARTIAL') return 'PARTIAL'
    if (state === 'NOT_CONNECTED' || row.dataState === 'NOT_CONNECTED') return 'NOT_CONNECTED'
    return row.dataState
  }, daily[0]?.dataState ?? 'NOT_CONNECTED')

  return {
    conversionKey: input.conversionKey,
    displayName: def?.displayName ?? input.conversionKey,
    managedSiteId: input.managedSiteId,
    timezone: 'UTC',
    limitations: [
      'Counts aggregate stored AnalyticsConversionObservation rows only; no live provider fetch.',
      'Conversion rate uses GA4 sessions from the same range when sessions are known; otherwise rate is null.',
    ],
    summary: {
      count: totalCount,
      uniqueCount: totalUnique,
      rate: conversionRate(totalCount, input.sessionsTotal),
      dataState: worstState,
      sessionsKnown: input.sessionsTotal != null,
    },
    daily: daily.map((row) => ({
      periodDate: row.periodDate.toISOString().slice(0, 10),
      count: row.count,
      uniqueCount: row.uniqueCount,
      dataState: row.dataState,
      provenance: 'STORED_CONVERSION_AGGREGATE',
      sourceProvider: row.sourceProvider,
      measuredAt: row.observedAt.toISOString(),
      idempotencyKey: row.idempotencyKey,
    })),
  }
}
import { ANALYTICS_DEFAULT_TIMEZONE } from '@/config/analytics-backend'
import type { AnalyticsDateRange } from '@/lib/platform/analytics/date-range'
import { mapSeoDataStateToFreshness } from '@/lib/platform/analytics/normalize'
import type { SeoAnalyticsProvider } from '@prisma/client'
import type { AnalyticsStore } from '@/lib/platform/analytics/store'

export type AnalyticsMeasurementPointDto = {
  date: string | null
  value: number | null
  dataState: ReturnType<typeof mapSeoDataStateToFreshness>
  provenance: 'STORED_PROVIDER_OBSERVATION'
  sourceRef: string
  observedAt: string
  idempotencyKey: string
}

export type AnalyticsMeasurementsDto = {
  metric: string
  provider: SeoAnalyticsProvider | string
  timezone: string
  limitations: string[]
  points: AnalyticsMeasurementPointDto[]
}

const METRIC_PATTERN = /^[a-z0-9._-]{1,96}$/i

function providerForMetric(metric: string): SeoAnalyticsProvider | string {
  if (metric.startsWith('ga4.')) return 'GA4'
  if (metric.startsWith('gbp.')) return 'GBP'
  if (metric.startsWith('gsc.')) return 'GSC'
  return 'WEBXXL_EVENTS'
}

export function validateAnalyticsMetricParam(metric: string): { ok: true; metric: string } | { ok: false; message: string } {
  const trimmed = metric.trim()
  if (!trimmed) return { ok: false, message: 'metric query param required' }
  if (!METRIC_PATTERN.test(trimmed)) return { ok: false, message: 'metric format invalid' }
  return { ok: true, metric: trimmed }
}

export async function buildAnalyticsMeasurements(
  store: AnalyticsStore,
  input: {
    customerAccountId: string
    managedSiteId: string
    metric: string
    range: AnalyticsDateRange
  },
): Promise<AnalyticsMeasurementsDto> {
  const provider = providerForMetric(input.metric) as SeoAnalyticsProvider
  const rows = await store.listMetricMeasurements({
    customerAccountId: input.customerAccountId,
    managedSiteId: input.managedSiteId,
    provider,
    metricDefinition: input.metric,
    range: input.range,
  })

  return {
    metric: input.metric,
    provider,
    timezone: ANALYTICS_DEFAULT_TIMEZONE,
    limitations: [
      'Points are persisted SeoMetricObservation rows; values are never fabricated when dataState is not READY.',
      'sourceRef and idempotencyKey identify stored provider evidence; live fetch requires separate owner activation.',
    ],
    points: rows.map((row) => ({
      date: row.date?.toISOString().slice(0, 10) ?? null,
      value: row.value,
      dataState: mapSeoDataStateToFreshness(row.dataState),
      provenance: 'STORED_PROVIDER_OBSERVATION',
      sourceRef: row.sourceRef,
      observedAt: row.observedAt.toISOString(),
      idempotencyKey: row.idempotencyKey,
    })),
  }
}
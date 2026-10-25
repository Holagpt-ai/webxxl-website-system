import {
  isAnalyticsFirstPartyCaptureEnabled,
  isAnalyticsIngestionEnabled,
  ANALYTICS_DEFAULT_TIMEZONE,
} from '@/config/analytics-backend'
import {
  isSeoGa4ApiEnabled,
  isSeoGbpApiEnabled,
  isSeoGoogleOauthEnabled,
  isSeoGscApiEnabled,
} from '@/config/seo-backend'
import { isAnalyticsBackendEnabled } from '@/config/analytics-backend'
import type { AnalyticsDateRange } from '@/lib/platform/analytics/date-range'
import { previousPeriod } from '@/lib/platform/analytics/date-range'
import { buildAnalyticsCrmRelationship } from '@/lib/platform/analytics/crm-bridge'
import type {
  AnalyticsAcquisitionRowDto,
  AnalyticsConversionSummaryRowDto,
  AnalyticsFeatureFlagsDto,
  AnalyticsLocalPerformanceDto,
  AnalyticsOverviewDto,
  AnalyticsPropertyConnectionDto,
  AnalyticsSearchPerformanceDto,
  AnalyticsSyncStatusDto,
  AnalyticsTrafficSeriesPointDto,
  AnalyticsTrendSeriesDto,
} from '@/lib/platform/analytics/dto'
import {
  ANALYTICS_GA4_ACQUISITION_DIMENSION,
  ANALYTICS_GA4_METRICS,
  ANALYTICS_GBP_METRICS,
  acquisitionMetricDefinition,
} from '@/lib/platform/analytics/metric-catalog'
import { conversionRate, mapSeoDataStateToFreshness, sumMetricValues } from '@/lib/platform/analytics/normalize'
import { computePeriodChange } from '@/lib/platform/analytics/period-over-period'
import type { AnalyticsStore } from '@/lib/platform/analytics/store'
import type { AnalyticsFreshnessState } from '@/lib/platform/analytics/types'
import { buildGscPerformanceFromObservations } from '@/lib/platform/seo/gsc-performance-read'

function featureFlags(): AnalyticsFeatureFlagsDto {
  return {
    backendEnabled: isAnalyticsBackendEnabled(),
    ingestionEnabled: isAnalyticsIngestionEnabled(),
    firstPartyCaptureEnabled: isAnalyticsFirstPartyCaptureEnabled(),
    seoGscApiEnabled: isSeoGscApiEnabled(),
    seoGa4ApiEnabled: isSeoGa4ApiEnabled(),
    seoGbpApiEnabled: isSeoGbpApiEnabled(),
    seoGoogleOauthEnabled: isSeoGoogleOauthEnabled(),
  }
}

function trafficSeries(metrics: Awaited<ReturnType<AnalyticsStore['listMetrics']>>): AnalyticsTrafficSeriesPointDto[] {
  const byDate = new Map<string, { sessions: number | null; users: number | null; dataState: AnalyticsFreshnessState }>()
  for (const row of metrics) {
    if (!row.date) continue
    const key = row.date.toISOString().slice(0, 10)
    const entry = byDate.get(key) ?? { sessions: null, users: null, dataState: 'NOT_CONNECTED' as AnalyticsFreshnessState }
    const state = mapSeoDataStateToFreshness(row.dataState)
    if (row.metricDefinition === ANALYTICS_GA4_METRICS.sessions) {
      entry.sessions = (entry.sessions ?? 0) + (row.value ?? 0)
      entry.dataState = state
    }
    if (row.metricDefinition === ANALYTICS_GA4_METRICS.users) {
      entry.users = (entry.users ?? 0) + (row.value ?? 0)
      entry.dataState = state
    }
    byDate.set(key, entry)
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, sessions: v.sessions, users: v.users, dataState: v.dataState }))
}

function acquisitionRows(metrics: Awaited<ReturnType<AnalyticsStore['listMetrics']>>): AnalyticsAcquisitionRowDto[] {
  const rows = metrics.filter(
    (m) => m.dimension === ANALYTICS_GA4_ACQUISITION_DIMENSION || m.metricDefinition.startsWith('ga4.acquisition.'),
  )
  const byChannel = new Map<string, AnalyticsAcquisitionRowDto>()
  for (const row of rows) {
    const channel = row.dimensionValue ?? row.metricDefinition.replace('ga4.acquisition.', '')
    const existing = byChannel.get(channel) ?? {
      channel,
      sessions: null,
      dataState: mapSeoDataStateToFreshness(row.dataState),
    }
    if (row.value != null) existing.sessions = (existing.sessions ?? 0) + row.value
    byChannel.set(channel, existing)
  }
  return [...byChannel.values()]
}

export async function buildAnalyticsOverview(
  store: AnalyticsStore,
  input: { customerAccountId: string; managedSiteId: string; range: AnalyticsDateRange },
): Promise<AnalyticsOverviewDto> {
  const prev = previousPeriod(input.range)
  const [ga4Current, ga4Previous, gbpMetrics, keywords, rankCount, conversions, syncRuns, crm] = await Promise.all([
    store.listMetrics({
      customerAccountId: input.customerAccountId,
      managedSiteId: input.managedSiteId,
      provider: 'GA4',
      range: input.range,
    }),
    store.listMetrics({
      customerAccountId: input.customerAccountId,
      managedSiteId: input.managedSiteId,
      provider: 'GA4',
      range: prev,
      metricDefinitions: [ANALYTICS_GA4_METRICS.sessions],
    }),
    store.listMetrics({
      customerAccountId: input.customerAccountId,
      managedSiteId: input.managedSiteId,
      provider: 'GBP',
      range: input.range,
      metricDefinitions: Object.values(ANALYTICS_GBP_METRICS),
    }),
    store.listKeywordObservations({
      customerAccountId: input.customerAccountId,
      managedSiteId: input.managedSiteId,
      range: input.range,
    }),
    store.countLocalRankObservations(input.managedSiteId, input.range),
    store.summarizeConversions({
      customerAccountId: input.customerAccountId,
      managedSiteId: input.managedSiteId,
      range: input.range,
    }),
    store.listSyncRuns(input.customerAccountId, input.managedSiteId),
    store.crmCounts(input.customerAccountId, input.range),
  ])

  const sessionSum = sumMetricValues(
    ga4Current.filter((m) => m.metricDefinition === ANALYTICS_GA4_METRICS.sessions).map((m) => m),
  )
  const sessionPrev = sumMetricValues(ga4Previous.map((m) => m))

  const gsc = buildGscPerformanceFromObservations({
    connectionDataState: keywords.length ? 'READY' : 'NOT_CONNECTED',
    propertyRef: '',
    rows: keywords.map((k) => ({
      idempotencyKey: k.idempotencyKey,
      query: '',
      page: null,
      clicks: k.clicks,
      impressions: k.impressions,
      ctr: k.ctr,
      averagePosition: k.averagePosition,
      date: k.date,
      dataState: k.dataState,
    })),
  })

  const search: AnalyticsSearchPerformanceDto = {
    dataState: mapSeoDataStateToFreshness(gsc.dataState),
    propertyRef: gsc.propertyRef,
    clicks: gsc.clicks,
    impressions: gsc.impressions,
    ctr: gsc.ctr,
    averagePosition: gsc.averagePosition,
    averagePositionLabel: gsc.averagePositionLabel,
    dateRange: gsc.dateRange,
    asOf: gsc.asOf,
  }

  const gbpViews = sumMetricValues(gbpMetrics.filter((m) => m.metricDefinition === ANALYTICS_GBP_METRICS.views).map((m) => m))
  const gbpSearches = sumMetricValues(
    gbpMetrics.filter((m) => m.metricDefinition === ANALYTICS_GBP_METRICS.searches).map((m) => m),
  )
  const gbpActions = sumMetricValues(gbpMetrics.filter((m) => m.metricDefinition === ANALYTICS_GBP_METRICS.actions).map((m) => m))

  const local: AnalyticsLocalPerformanceDto = {
    dataState:
      gbpViews.dataState === 'NOT_CONNECTED' && rankCount === 0 ? 'NOT_CONNECTED' : gbpViews.dataState,
    profileViews: gbpViews.total,
    searchQueries: gbpSearches.total,
    actions: gbpActions.total,
    rankObservations: rankCount,
    limitations: [
      'Local rank positions require a licensed rank provider when enabled.',
      'GBP metrics require a verified Google Business Profile connection.',
    ],
  }

  const conversionRows: AnalyticsConversionSummaryRowDto[] = conversions.map((c) => ({
    conversionKey: c.conversionKey,
    displayName: c.displayName,
    count: c.count,
    uniqueCount: c.uniqueCount ?? c.count,
    rate: conversionRate(c.count, sessionSum.total),
    dataState: mapSeoDataStateToFreshness(c.dataState),
    sourceProvider: c.sourceProvider,
  }))

  const sync: AnalyticsSyncStatusDto = {
    ingestionEnabled: isAnalyticsIngestionEnabled(),
    dataState: syncRuns.length ? mapSeoDataStateToFreshness(syncRuns[0]!.dataState) : 'NOT_CONNECTED',
    runs: syncRuns.map((r) => ({
      provider: r.provider,
      status: r.status,
      dataState: mapSeoDataStateToFreshness(r.dataState),
      scheduledAt: r.scheduledAt.toISOString(),
      processedAt: r.processedAt?.toISOString() ?? null,
      errorClass: r.errorClass,
    })),
  }

  return {
    customerAccountId: input.customerAccountId,
    managedSiteId: input.managedSiteId,
    timezone: ANALYTICS_DEFAULT_TIMEZONE,
    flags: featureFlags(),
    freshness: [
      { provider: 'GA4', dataState: sessionSum.dataState, observedAt: null, timezone: ANALYTICS_DEFAULT_TIMEZONE },
      { provider: 'GSC', dataState: search.dataState, observedAt: search.asOf ?? null, timezone: ANALYTICS_DEFAULT_TIMEZONE },
      { provider: 'GBP', dataState: gbpViews.dataState, observedAt: null, timezone: ANALYTICS_DEFAULT_TIMEZONE },
      { provider: 'WEBXXL_EVENTS', dataState: conversionRows.length ? 'READY' : 'NOT_CONNECTED', observedAt: null, timezone: ANALYTICS_DEFAULT_TIMEZONE },
    ],
    traffic: {
      dataState: sessionSum.dataState,
      series: trafficSeries(ga4Current),
      periodChanges: [
        computePeriodChange({
          metric: ANALYTICS_GA4_METRICS.sessions,
          current: sessionSum.total,
          previous: sessionPrev.total,
          dataState: sessionSum.dataState,
          note: 'Period-over-period uses calendar-aligned previous window.',
        }),
      ],
    },
    search,
    local,
    conversions: conversionRows,
    acquisition: acquisitionRows(ga4Current),
    crm: buildAnalyticsCrmRelationship(crm),
    sync,
  }
}

export function mapConnections(rows: Awaited<ReturnType<AnalyticsStore['listConnections']>>): AnalyticsPropertyConnectionDto[] {
  return rows.map((c) => ({
    managedSiteId: c.managedSiteId,
    siteName: c.siteName,
    domain: c.domain,
    provider: c.provider as AnalyticsPropertyConnectionDto['provider'],
    propertyRef: c.propertyRef,
    propertyKind: c.propertyKind,
    verificationState: c.verificationState,
    dataState: mapSeoDataStateToFreshness(c.dataState),
    lastVerifiedAt: c.lastVerifiedAt?.toISOString() ?? null,
    updatedAt: c.updatedAt.toISOString(),
  }))
}

export async function buildAnalyticsTrendSeries(
  store: AnalyticsStore,
  input: {
    customerAccountId: string
    managedSiteId: string
    range: AnalyticsDateRange
    metric: string
  },
): Promise<AnalyticsTrendSeriesDto> {
  const metrics = await store.listMetrics({
    customerAccountId: input.customerAccountId,
    managedSiteId: input.managedSiteId,
    provider: 'GA4',
    range: input.range,
    metricDefinitions: [input.metric],
  })
  const points = trafficSeries(metrics)
    .filter(() => input.metric === ANALYTICS_GA4_METRICS.sessions || input.metric === ANALYTICS_GA4_METRICS.users)
    .map((p) => ({
      date: p.date,
      value: input.metric === ANALYTICS_GA4_METRICS.users ? p.users : p.sessions,
      dataState: p.dataState,
    }))
  return {
    metric: input.metric,
    provider: 'GA4',
    timezone: ANALYTICS_DEFAULT_TIMEZONE,
    points,
  }
}

export { acquisitionMetricDefinition }

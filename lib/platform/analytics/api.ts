import { isAnalyticsBackendEnabled } from '@/config/analytics-backend'
import type { AnalyticsDateRange } from '@/lib/platform/analytics/date-range'
import {
  buildAnalyticsOverview,
  buildAnalyticsTrendSeries,
  mapConnections,
} from '@/lib/platform/analytics/bi/summary-service'
import { buildAnalyticsConversionDetail } from '@/lib/platform/analytics/conversion-detail-service'
import {
  buildAnalyticsMeasurements,
  validateAnalyticsMetricParam,
} from '@/lib/platform/analytics/measurements-read-service'
import { sumMetricValues } from '@/lib/platform/analytics/normalize'
import { ANALYTICS_GA4_METRICS } from '@/lib/platform/analytics/metric-catalog'
import type {
  AnalyticsOverviewDto,
  AnalyticsPropertyConnectionDto,
  AnalyticsSyncStatusDto,
  AnalyticsTrendSeriesDto,
} from '@/lib/platform/analytics/dto'
import type { AnalyticsConversionDetailDto } from '@/lib/platform/analytics/conversion-detail-service'
import type { AnalyticsMeasurementsDto } from '@/lib/platform/analytics/measurements-read-service'
import type { AnalyticsActor, AnalyticsResult } from '@/lib/platform/analytics/types'
import type { AnalyticsStore } from '@/lib/platform/analytics/store'

function disabled<T>(): AnalyticsResult<T> {
  return { ok: false, error: 'ANALYTICS_DISABLED', message: 'Analytics backend disabled' }
}

async function assertAccountAccess(
  store: AnalyticsStore,
  actor: AnalyticsActor,
  customerAccountId: string,
): Promise<AnalyticsResult<true>> {
  if (store.isStaff(actor.userId, actor.platformRole)) return { ok: true, value: true }
  if (await store.hasOperatingMembership(actor.userId, customerAccountId)) return { ok: true, value: true }
  return { ok: false, error: 'FORBIDDEN', message: 'Operating membership required' }
}

async function resolveSite(
  store: AnalyticsStore,
  customerAccountId: string,
  managedSiteId: string | null,
): Promise<AnalyticsResult<{ id: string }>> {
  const site = await store.resolveManagedSite(customerAccountId, managedSiteId)
  if (!site) return { ok: false, error: 'NOT_FOUND', message: 'Managed site not found for account' }
  return { ok: true, value: { id: site.id } }
}

export async function getAnalyticsOverview(
  store: AnalyticsStore,
  actor: AnalyticsActor,
  customerAccountId: string,
  range: AnalyticsDateRange,
  managedSiteId: string | null,
): Promise<AnalyticsResult<AnalyticsOverviewDto>> {
  if (!isAnalyticsBackendEnabled()) return disabled()
  const access = await assertAccountAccess(store, actor, customerAccountId)
  if (!access.ok) return access
  const site = await resolveSite(store, customerAccountId, managedSiteId)
  if (!site.ok) return site
  const value = await buildAnalyticsOverview(store, {
    customerAccountId,
    managedSiteId: site.value.id,
    range,
  })
  return { ok: true, value }
}

export async function listAnalyticsProperties(
  store: AnalyticsStore,
  actor: AnalyticsActor,
  customerAccountId: string,
  managedSiteId: string | null,
): Promise<AnalyticsResult<AnalyticsPropertyConnectionDto[]>> {
  if (!isAnalyticsBackendEnabled()) return disabled()
  const access = await assertAccountAccess(store, actor, customerAccountId)
  if (!access.ok) return access
  if (managedSiteId) {
    const site = await resolveSite(store, customerAccountId, managedSiteId)
    if (!site.ok) return site
  }
  const rows = await store.listConnections(customerAccountId, managedSiteId)
  return { ok: true, value: mapConnections(rows) }
}

export async function getAnalyticsTraffic(
  store: AnalyticsStore,
  actor: AnalyticsActor,
  customerAccountId: string,
  range: AnalyticsDateRange,
  managedSiteId: string | null,
): Promise<AnalyticsResult<AnalyticsOverviewDto['traffic']>> {
  const overview = await getAnalyticsOverview(store, actor, customerAccountId, range, managedSiteId)
  if (!overview.ok) return overview
  return { ok: true, value: overview.value.traffic }
}

export async function getAnalyticsSearch(
  store: AnalyticsStore,
  actor: AnalyticsActor,
  customerAccountId: string,
  range: AnalyticsDateRange,
  managedSiteId: string | null,
): Promise<AnalyticsResult<AnalyticsOverviewDto['search']>> {
  const overview = await getAnalyticsOverview(store, actor, customerAccountId, range, managedSiteId)
  if (!overview.ok) return overview
  return { ok: true, value: overview.value.search }
}

export async function getAnalyticsLocal(
  store: AnalyticsStore,
  actor: AnalyticsActor,
  customerAccountId: string,
  range: AnalyticsDateRange,
  managedSiteId: string | null,
): Promise<AnalyticsResult<AnalyticsOverviewDto['local']>> {
  const overview = await getAnalyticsOverview(store, actor, customerAccountId, range, managedSiteId)
  if (!overview.ok) return overview
  return { ok: true, value: overview.value.local }
}

export async function getAnalyticsConversions(
  store: AnalyticsStore,
  actor: AnalyticsActor,
  customerAccountId: string,
  range: AnalyticsDateRange,
  managedSiteId: string | null,
): Promise<AnalyticsResult<AnalyticsOverviewDto['conversions']>> {
  const overview = await getAnalyticsOverview(store, actor, customerAccountId, range, managedSiteId)
  if (!overview.ok) return overview
  return { ok: true, value: overview.value.conversions }
}

export async function getAnalyticsTrends(
  store: AnalyticsStore,
  actor: AnalyticsActor,
  customerAccountId: string,
  range: AnalyticsDateRange,
  managedSiteId: string | null,
  metric: string,
): Promise<AnalyticsResult<AnalyticsTrendSeriesDto>> {
  if (!isAnalyticsBackendEnabled()) return disabled()
  const access = await assertAccountAccess(store, actor, customerAccountId)
  if (!access.ok) return access
  const site = await resolveSite(store, customerAccountId, managedSiteId)
  if (!site.ok) return site
  if (!metric.trim()) return { ok: false, error: 'VALIDATION', message: 'metric query param required' }
  const value = await buildAnalyticsTrendSeries(store, {
    customerAccountId,
    managedSiteId: site.value.id,
    range,
    metric: metric.trim(),
  })
  return { ok: true, value }
}

export async function getAnalyticsAcquisition(
  store: AnalyticsStore,
  actor: AnalyticsActor,
  customerAccountId: string,
  range: AnalyticsDateRange,
  managedSiteId: string | null,
): Promise<AnalyticsResult<AnalyticsOverviewDto['acquisition']>> {
  const overview = await getAnalyticsOverview(store, actor, customerAccountId, range, managedSiteId)
  if (!overview.ok) return overview
  return { ok: true, value: overview.value.acquisition }
}

export async function getAnalyticsConversionDetail(
  store: AnalyticsStore,
  actor: AnalyticsActor,
  customerAccountId: string,
  range: AnalyticsDateRange,
  managedSiteId: string | null,
  conversionKey: string,
): Promise<AnalyticsResult<AnalyticsConversionDetailDto>> {
  if (!isAnalyticsBackendEnabled()) return disabled()
  const access = await assertAccountAccess(store, actor, customerAccountId)
  if (!access.ok) return access
  const site = await resolveSite(store, customerAccountId, managedSiteId)
  if (!site.ok) return site
  const key = conversionKey.trim()
  if (!key) return { ok: false, error: 'VALIDATION', message: 'conversionKey required' }
  const sessions = await store.listMetrics({
    customerAccountId,
    managedSiteId: site.value.id,
    provider: 'GA4',
    range,
    metricDefinitions: [ANALYTICS_GA4_METRICS.sessions],
  })
  const sessionsTotal = sumMetricValues(
    sessions.map((row) => ({ value: row.value, dataState: row.dataState })),
  ).total
  const defs = await store.listConversionDefinitions(customerAccountId, site.value.id)
  const daily = await store.listConversionDaily({
    customerAccountId,
    managedSiteId: site.value.id,
    conversionKey: key,
    range,
  })
  if (!defs.some((d) => d.key === key) && daily.length === 0) {
    return { ok: false, error: 'NOT_FOUND', message: 'Unknown conversion key for account site' }
  }
  const value = await buildAnalyticsConversionDetail(store, {
    customerAccountId,
    managedSiteId: site.value.id,
    conversionKey: key,
    range,
    sessionsTotal,
  })
  return { ok: true, value }
}

export async function getAnalyticsMeasurements(
  store: AnalyticsStore,
  actor: AnalyticsActor,
  customerAccountId: string,
  range: AnalyticsDateRange,
  managedSiteId: string | null,
  metric: string,
): Promise<AnalyticsResult<AnalyticsMeasurementsDto>> {
  if (!isAnalyticsBackendEnabled()) return disabled()
  const validated = validateAnalyticsMetricParam(metric)
  if (!validated.ok) return { ok: false, error: 'VALIDATION', message: validated.message }
  const access = await assertAccountAccess(store, actor, customerAccountId)
  if (!access.ok) return access
  const site = await resolveSite(store, customerAccountId, managedSiteId)
  if (!site.ok) return site
  const value = await buildAnalyticsMeasurements(store, {
    customerAccountId,
    managedSiteId: site.value.id,
    metric: validated.metric,
    range,
  })
  return { ok: true, value }
}

export async function getAnalyticsSyncStatus(
  store: AnalyticsStore,
  actor: AnalyticsActor,
  customerAccountId: string,
  managedSiteId: string | null,
): Promise<AnalyticsResult<AnalyticsSyncStatusDto>> {
  const overview = await getAnalyticsOverview(
    store,
    actor,
    customerAccountId,
    {
      start: new Date(),
      end: new Date(),
      startIso: new Date().toISOString().slice(0, 10),
      endIso: new Date().toISOString().slice(0, 10),
    },
    managedSiteId,
  )
  if (!overview.ok) return overview
  return { ok: true, value: overview.value.sync }
}

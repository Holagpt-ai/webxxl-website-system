import { prisma } from '@/lib/db'
import { buildSeoKeywordIdempotencyKey, buildSeoMetricIdempotencyKey } from '@/lib/platform/seo/ingest-idempotency'
import { aggregateGscTraffic } from '@/lib/platform/seo/gsc-normalize'
import type { GscNormalizedRow } from '@/lib/platform/seo/gsc-types'
import type { SeoAnalyticsProvider, SeoDataState } from '@prisma/client'

export async function persistGscDailyMetrics(input: {
  customerAccountId: string
  managedSiteId: string
  provider: SeoAnalyticsProvider
  propertyRef: string
  rows: GscNormalizedRow[]
  observedAt: Date
  dataState: SeoDataState
}): Promise<{ metrics: number; keywords: number }> {
  const byDate = new Map<string, GscNormalizedRow[]>()
  for (const row of input.rows) {
    if (!row.date) continue
    const list = byDate.get(row.date) ?? []
    list.push(row)
    byDate.set(row.date, list)
  }

  let metrics = 0
  let keywords = 0

  for (const [dateIso, dayRows] of byDate) {
    const day = new Date(`${dateIso}T00:00:00.000Z`)
    const totals = aggregateGscTraffic(dayRows)
    if (totals.clicks != null || totals.impressions != null) {
      const clicksKey = buildSeoMetricIdempotencyKey({
        managedSiteId: input.managedSiteId,
        provider: input.provider,
        metricDefinition: 'gsc.clicks',
        dimension: 'site',
        dimensionValue: 'daily',
        date: dateIso,
      })
      await prisma.seoMetricObservation.upsert({
        where: { idempotencyKey: clicksKey },
        create: {
          customerAccountId: input.customerAccountId,
          managedSiteId: input.managedSiteId,
          provider: input.provider,
          metricDefinition: 'gsc.clicks',
          dimension: 'site',
          dimensionValue: 'daily',
          value: totals.clicks,
          dataState: input.dataState,
          date: day,
          observedAt: input.observedAt,
          sourceRef: input.propertyRef,
          idempotencyKey: clicksKey,
        },
        update: {
          value: totals.clicks,
          dataState: input.dataState,
          observedAt: input.observedAt,
        },
      })
      metrics += 1

      const impressionsKey = buildSeoMetricIdempotencyKey({
        managedSiteId: input.managedSiteId,
        provider: input.provider,
        metricDefinition: 'gsc.impressions',
        dimension: 'site',
        dimensionValue: 'daily',
        date: dateIso,
      })
      await prisma.seoMetricObservation.upsert({
        where: { idempotencyKey: impressionsKey },
        create: {
          customerAccountId: input.customerAccountId,
          managedSiteId: input.managedSiteId,
          provider: input.provider,
          metricDefinition: 'gsc.impressions',
          dimension: 'site',
          dimensionValue: 'daily',
          value: totals.impressions,
          dataState: input.dataState,
          date: day,
          observedAt: input.observedAt,
          sourceRef: input.propertyRef,
          idempotencyKey: impressionsKey,
        },
        update: {
          value: totals.impressions,
          dataState: input.dataState,
          observedAt: input.observedAt,
        },
      })
      metrics += 1
    }

    for (const row of dayRows) {
      if (!row.query) continue
      const idempotencyKey = buildSeoKeywordIdempotencyKey({
        managedSiteId: input.managedSiteId,
        provider: input.provider,
        query: row.query,
        page: row.page ?? null,
        date: dateIso,
      })
      await prisma.seoKeywordObservation.upsert({
        where: { idempotencyKey },
        create: {
          customerAccountId: input.customerAccountId,
          managedSiteId: input.managedSiteId,
          provider: input.provider,
          query: row.query,
          page: row.page ?? null,
          clicks: row.clicks ?? null,
          impressions: row.impressions ?? null,
          ctr: row.ctr ?? null,
          averagePosition: row.averagePosition ?? null,
          dataState: input.dataState,
          date: day,
          observedAt: input.observedAt,
          idempotencyKey,
        },
        update: {
          clicks: row.clicks ?? null,
          impressions: row.impressions ?? null,
          ctr: row.ctr ?? null,
          averagePosition: row.averagePosition ?? null,
          dataState: input.dataState,
          observedAt: input.observedAt,
        },
      })
      keywords += 1
    }
  }

  return { metrics, keywords }
}

export async function persistGa4SessionMetric(input: {
  customerAccountId: string
  managedSiteId: string
  dateIso: string
  sessions: number | null
  dataState: SeoDataState
  propertyRef: string
  observedAt: Date
}): Promise<void> {
  const day = new Date(`${input.dateIso}T00:00:00.000Z`)
  const idempotencyKey = buildSeoMetricIdempotencyKey({
    managedSiteId: input.managedSiteId,
    provider: 'GA4',
    metricDefinition: 'ga4.sessions',
    date: input.dateIso,
  })
  await prisma.seoMetricObservation.upsert({
    where: { idempotencyKey },
    create: {
      customerAccountId: input.customerAccountId,
      managedSiteId: input.managedSiteId,
      provider: 'GA4',
      metricDefinition: 'ga4.sessions',
      value: input.sessions,
      dataState: input.dataState,
      date: day,
      observedAt: input.observedAt,
      sourceRef: input.propertyRef,
      idempotencyKey,
    },
    update: {
      value: input.sessions,
      dataState: input.dataState,
      observedAt: input.observedAt,
    },
  })
}

import { prisma } from '@/lib/db'
import { buildSeoKeywordIdempotencyKey, buildSeoMetricIdempotencyKey } from '@/lib/platform/seo/ingest-idempotency'
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
  let metrics = 0
  let keywords = 0
  for (const row of input.rows) {
    if (!row.date) continue
    const day = new Date(`${row.date}T00:00:00.000Z`)
    if (row.clicks != null || row.impressions != null) {
      const idempotencyKey = buildSeoMetricIdempotencyKey({
        managedSiteId: input.managedSiteId,
        provider: input.provider,
        metricDefinition: 'gsc.clicks',
        date: row.date,
      })
      await prisma.seoMetricObservation.upsert({
        where: { idempotencyKey },
        create: {
          customerAccountId: input.customerAccountId,
          managedSiteId: input.managedSiteId,
          provider: input.provider,
          metricDefinition: 'gsc.clicks',
          value: row.clicks ?? null,
          dataState: input.dataState,
          date: day,
          observedAt: input.observedAt,
          sourceRef: input.propertyRef,
          idempotencyKey,
        },
        update: {
          value: row.clicks ?? null,
          dataState: input.dataState,
          observedAt: input.observedAt,
        },
      })
      metrics += 1
    }
    if (row.query) {
      const idempotencyKey = buildSeoKeywordIdempotencyKey({
        managedSiteId: input.managedSiteId,
        provider: input.provider,
        query: row.query,
        page: row.page ?? null,
        date: row.date,
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

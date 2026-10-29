import { SEO_GSC_MAX_ROWS } from '@/config/seo-backend'
import { prisma } from '@/lib/db'
import {
  buildGscPerformanceFromObservations,
  type GscPerformanceReadModel,
  type PersistedKeywordRow,
} from '@/lib/platform/seo/gsc-performance-read'
import { matchGscPropertyToSite } from '@/lib/platform/seo/property-match'
import { requireManagedSiteInAccount } from '@/lib/platform/seo/site-scope'
import type { SeoResult } from '@/lib/platform/seo/types'

export type GscStoredSiteBundle = {
  propertyRef: string
  connectionDataState: string
  snapshot: {
    start: string
    end: string
    observedAt: string
    methodologyVersion: string
    propertyRef: string
  } | null
  rows: PersistedKeywordRow[]
  performance: GscPerformanceReadModel
  limitations: string[]
}

function mapKeywordRow(k: {
  idempotencyKey: string
  query: string
  page: string | null
  clicks: number | null
  impressions: number | null
  ctr: number | null
  averagePosition: number | null
  date: Date
  dataState: string
  observedAt: Date
}): PersistedKeywordRow & { observedAt: Date } {
  return {
    idempotencyKey: k.idempotencyKey,
    query: k.query,
    page: k.page,
    clicks: k.clicks,
    impressions: k.impressions,
    ctr: k.ctr,
    averagePosition: k.averagePosition,
    date: k.date,
    dataState: k.dataState,
    observedAt: k.observedAt,
  }
}

/**
 * Loads stored GSC keyword rows for the site's active GSC connection and latest matching snapshot window.
 * Observations are scoped by managedSiteId + account + snapshot date range; property association uses
 * connection.propertyRef aligned with SeoSnapshot.propertyRef (not per-row property refs).
 */
export async function loadGscStoredSiteBundle(input: {
  customerAccountId: string
  managedSiteId: string
}): Promise<SeoResult<GscStoredSiteBundle>> {
  const site = await requireManagedSiteInAccount({
    siteId: input.managedSiteId,
    customerAccountId: input.customerAccountId,
  })
  if (!site.ok) return site

  const connection = await prisma.siteAnalyticsConnection.findFirst({
    where: {
      managedSiteId: site.value.id,
      customerAccountId: input.customerAccountId,
      provider: 'GSC',
    },
  })

  if (!connection || connection.dataState === 'NOT_CONNECTED') {
    const performance = buildGscPerformanceFromObservations({
      connectionDataState: 'NOT_CONNECTED',
      propertyRef: '',
      rows: [],
    })
    return {
      ok: true,
      value: {
        propertyRef: '',
        connectionDataState: 'NOT_CONNECTED',
        snapshot: null,
        rows: [],
        performance,
        limitations: ['GSC connection not configured for this site'],
      },
    }
  }

  const propertyMatch = matchGscPropertyToSite({
    propertyRef: connection.propertyRef,
    authorizedHosts: site.value.authorizedHosts,
    siteCanonicalUrl: site.value.domain,
  })
  const limitations: string[] = []
  if (!propertyMatch.ok) {
    limitations.push(propertyMatch.message)
    const performance = buildGscPerformanceFromObservations({
      connectionDataState: 'PARTIAL',
      propertyRef: connection.propertyRef,
      rows: [],
      requireVerifiedSnapshotWindow: true,
    })
    return {
      ok: true,
      value: {
        propertyRef: connection.propertyRef,
        connectionDataState: connection.dataState,
        snapshot: null,
        rows: [],
        performance,
        limitations,
      },
    }
  }

  const snapshot = await prisma.seoSnapshot.findFirst({
    where: {
      managedSiteId: site.value.id,
      customerAccountId: input.customerAccountId,
      provider: 'GSC',
      propertyRef: connection.propertyRef,
    },
    orderBy: { ingestedAt: 'desc' },
  })

  if (!snapshot) {
    const performance = buildGscPerformanceFromObservations({
      connectionDataState: connection.dataState,
      propertyRef: connection.propertyRef,
      rows: [],
      requireVerifiedSnapshotWindow: true,
    })
    return {
      ok: true,
      value: {
        propertyRef: connection.propertyRef,
        connectionDataState: connection.dataState,
        snapshot: null,
        rows: [],
        performance,
        limitations: ['No verified GSC snapshot window for this property'],
      },
    }
  }

  const keywords = await prisma.seoKeywordObservation.findMany({
    where: {
      managedSiteId: site.value.id,
      customerAccountId: input.customerAccountId,
      provider: 'GSC',
      date: { gte: snapshot.dateRangeStart, lte: snapshot.dateRangeEnd },
    },
    orderBy: [{ date: 'desc' }, { query: 'asc' }, { id: 'asc' }],
    take: SEO_GSC_MAX_ROWS,
  })

  const rows = keywords.map(mapKeywordRow)
  const performance = buildGscPerformanceFromObservations({
    connectionDataState: connection.dataState,
    propertyRef: connection.propertyRef,
    rows,
    snapshot: {
      start: snapshot.dateRangeStart.toISOString().slice(0, 10),
      end: snapshot.dateRangeEnd.toISOString().slice(0, 10),
      observedAt: snapshot.observedAt.toISOString(),
      methodologyVersion: snapshot.methodologyVersion,
    },
  })

  limitations.push(
    'Keyword rows are associated with the managed site and snapshot window; per-row GSC property refs are not stored',
  )

  return {
    ok: true,
    value: {
      propertyRef: connection.propertyRef,
      connectionDataState: connection.dataState,
      snapshot: {
        start: snapshot.dateRangeStart.toISOString().slice(0, 10),
        end: snapshot.dateRangeEnd.toISOString().slice(0, 10),
        observedAt: snapshot.observedAt.toISOString(),
        methodologyVersion: snapshot.methodologyVersion,
        propertyRef: snapshot.propertyRef,
      },
      rows,
      performance,
      limitations,
    },
  }
}

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
}): PersistedKeywordRow {
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

function emptyBundle(input: {
  propertyRef: string
  connectionDataState: string
  limitations: string[]
  requireSnapshot?: boolean
}): GscStoredSiteBundle {
  const performance = buildGscPerformanceFromObservations({
    connectionDataState: input.connectionDataState,
    propertyRef: input.propertyRef,
    rows: [],
    requireVerifiedSnapshotWindow: input.requireSnapshot ?? true,
  })
  return {
    propertyRef: input.propertyRef,
    connectionDataState: input.connectionDataState,
    snapshot: null,
    rows: [],
    performance,
    limitations: input.limitations,
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

  const gscConnections = await prisma.siteAnalyticsConnection.findMany({
    where: {
      managedSiteId: site.value.id,
      customerAccountId: input.customerAccountId,
      provider: 'GSC',
    },
    orderBy: [{ lastVerifiedAt: 'desc' }, { updatedAt: 'desc' }],
  })

  const activeConnections = gscConnections.filter(
    (c) => c.revokedAt == null && c.dataState !== 'NOT_CONNECTED',
  )

  if (activeConnections.length === 0) {
    return {
      ok: true,
      value: emptyBundle({
        propertyRef: '',
        connectionDataState: 'NOT_CONNECTED',
        limitations: ['GSC connection not configured for this site'],
        requireSnapshot: false,
      }),
    }
  }

  const verifiedConnections = activeConnections.filter((c) => c.verificationState === 'VERIFIED')
  if (verifiedConnections.length === 0) {
    return {
      ok: true,
      value: emptyBundle({
        propertyRef: activeConnections[0]!.propertyRef,
        connectionDataState: 'PARTIAL',
        limitations: ['GSC connection is not verified; stored metrics are unavailable'],
      }),
    }
  }

  if (verifiedConnections.length > 1) {
    return {
      ok: true,
      value: emptyBundle({
        propertyRef: verifiedConnections[0]!.propertyRef,
        connectionDataState: 'PARTIAL',
        limitations: [
          'Multiple verified GSC properties are connected for this site; stored metrics are unavailable until a single property is selected',
        ],
      }),
    }
  }

  const connection = verifiedConnections[0]!

  const propertyMatch = matchGscPropertyToSite({
    propertyRef: connection.propertyRef,
    authorizedHosts: site.value.authorizedHosts,
    siteCanonicalUrl: site.value.domain,
  })
  const limitations: string[] = []
  if (!propertyMatch.ok) {
    limitations.push(propertyMatch.message)
    return {
      ok: true,
      value: emptyBundle({
        propertyRef: connection.propertyRef,
        connectionDataState: 'PARTIAL',
        limitations,
      }),
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
    return {
      ok: true,
      value: emptyBundle({
        propertyRef: connection.propertyRef,
        connectionDataState: connection.dataState,
        limitations: ['No verified GSC snapshot window for this property'],
      }),
    }
  }

  if (snapshot.propertyRef !== connection.propertyRef) {
    limitations.push('Latest GSC snapshot property does not match the active connection')
    return {
      ok: true,
      value: emptyBundle({
        propertyRef: connection.propertyRef,
        connectionDataState: 'PARTIAL',
        limitations,
      }),
    }
  }

  const overlappingOtherPropertySnapshots = await prisma.seoSnapshot.count({
    where: {
      managedSiteId: site.value.id,
      customerAccountId: input.customerAccountId,
      provider: 'GSC',
      propertyRef: { not: connection.propertyRef },
      dateRangeStart: { lte: snapshot.dateRangeEnd },
      dateRangeEnd: { gte: snapshot.dateRangeStart },
    },
  })
  if (overlappingOtherPropertySnapshots > 0) {
    limitations.push(
      'Overlapping GSC snapshot metadata exists for another property in this date window; keyword rows cannot be verified for the current property',
    )
    return {
      ok: true,
      value: {
        propertyRef: connection.propertyRef,
        connectionDataState: 'PARTIAL',
        snapshot: {
          start: snapshot.dateRangeStart.toISOString().slice(0, 10),
          end: snapshot.dateRangeEnd.toISOString().slice(0, 10),
          observedAt: snapshot.observedAt.toISOString(),
          methodologyVersion: snapshot.methodologyVersion,
          propertyRef: snapshot.propertyRef,
        },
        rows: [],
        performance: buildGscPerformanceFromObservations({
          connectionDataState: 'PARTIAL',
          propertyRef: connection.propertyRef,
          rows: [],
          snapshot: {
            start: snapshot.dateRangeStart.toISOString().slice(0, 10),
            end: snapshot.dateRangeEnd.toISOString().slice(0, 10),
            observedAt: snapshot.observedAt.toISOString(),
            methodologyVersion: snapshot.methodologyVersion,
          },
        }),
        limitations,
      },
    }
  }

  const metricSourceRefs = await prisma.seoMetricObservation.findMany({
    where: {
      managedSiteId: site.value.id,
      customerAccountId: input.customerAccountId,
      provider: 'GSC',
      date: { gte: snapshot.dateRangeStart, lte: snapshot.dateRangeEnd },
    },
    select: { sourceRef: true },
    distinct: ['sourceRef'],
  })
  const distinctMetricRefs = new Set(metricSourceRefs.map((m) => m.sourceRef))
  if (
    distinctMetricRefs.size > 1 ||
    (distinctMetricRefs.size === 1 && !distinctMetricRefs.has(connection.propertyRef))
  ) {
    limitations.push(
      'Stored GSC metric observations in this window reference multiple or mismatched property refs; aggregates are withheld',
    )
    return {
      ok: true,
      value: {
        propertyRef: connection.propertyRef,
        connectionDataState: 'PARTIAL',
        snapshot: {
          start: snapshot.dateRangeStart.toISOString().slice(0, 10),
          end: snapshot.dateRangeEnd.toISOString().slice(0, 10),
          observedAt: snapshot.observedAt.toISOString(),
          methodologyVersion: snapshot.methodologyVersion,
          propertyRef: snapshot.propertyRef,
        },
        rows: [],
        performance: buildGscPerformanceFromObservations({
          connectionDataState: 'PARTIAL',
          propertyRef: connection.propertyRef,
          rows: [],
          snapshot: {
            start: snapshot.dateRangeStart.toISOString().slice(0, 10),
            end: snapshot.dateRangeEnd.toISOString().slice(0, 10),
            observedAt: snapshot.observedAt.toISOString(),
            methodologyVersion: snapshot.methodologyVersion,
          },
        }),
        limitations,
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
    'SeoKeywordObservation rows do not store GSC propertyRef; metrics are scoped to the verified connection property and matching snapshot window only',
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

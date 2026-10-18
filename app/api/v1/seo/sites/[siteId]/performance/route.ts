import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { buildGscPerformanceFromObservations } from '@/lib/platform/seo/gsc-performance-read'
import { requireSeoApiActor, SeoApiError } from '@/lib/platform/seo/route-auth'

type Params = { params: Promise<{ siteId: string }> }

export async function GET(_request: Request, { params }: Params) {
  try {
    const actor = await requireSeoApiActor('seo.read')
    const { siteId } = await params
    const connection = await prisma.siteAnalyticsConnection.findFirst({
      where: { managedSiteId: siteId, customerAccountId: actor.customerAccountId, provider: 'GSC' },
    })
    if (!connection || connection.dataState === 'NOT_CONNECTED') {
      return NextResponse.json({
        gsc: buildGscPerformanceFromObservations({
          connectionDataState: 'NOT_CONNECTED',
          propertyRef: '',
          rows: [],
        }),
      })
    }

    const snapshot = await prisma.seoSnapshot.findFirst({
      where: { managedSiteId: siteId, provider: 'GSC', propertyRef: connection.propertyRef },
      orderBy: { ingestedAt: 'desc' },
    })

    const keywordWhere = {
      managedSiteId: siteId,
      customerAccountId: actor.customerAccountId,
      provider: 'GSC' as const,
      ...(snapshot
        ? {
            date: { gte: snapshot.dateRangeStart, lte: snapshot.dateRangeEnd },
          }
        : {}),
    }

    const keywords = await prisma.seoKeywordObservation.findMany({
      where: keywordWhere,
      take: 25000,
    })

    const gsc = buildGscPerformanceFromObservations({
      connectionDataState: connection.dataState,
      propertyRef: connection.propertyRef,
      rows: keywords.map((k) => ({
        idempotencyKey: k.idempotencyKey,
        query: k.query,
        page: k.page,
        clicks: k.clicks,
        impressions: k.impressions,
        ctr: k.ctr,
        averagePosition: k.averagePosition,
        date: k.date,
        dataState: k.dataState,
      })),
      snapshot: snapshot
        ? {
            start: snapshot.dateRangeStart.toISOString().slice(0, 10),
            end: snapshot.dateRangeEnd.toISOString().slice(0, 10),
            observedAt: snapshot.observedAt.toISOString(),
          }
        : null,
    })

    return NextResponse.json({ gsc })
  } catch (error) {
    if (error instanceof SeoApiError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.status })
    }
    console.error('seo performance GET failed', error)
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Unable to load SEO performance' }, { status: 500 })
  }
}

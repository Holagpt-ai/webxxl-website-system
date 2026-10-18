import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { aggregateGscAveragePosition, aggregateGscTraffic } from '@/lib/platform/seo/gsc-normalize'
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
        gsc: { dataState: 'NOT_CONNECTED', clicks: null, impressions: null, ctr: null, averagePosition: null },
      })
    }
    const keywords = await prisma.seoKeywordObservation.findMany({
      where: { managedSiteId: siteId, customerAccountId: actor.customerAccountId, provider: 'GSC' },
      take: 5000,
    })
    const rows = keywords.map((k) => ({
      query: k.query,
      page: k.page ?? undefined,
      clicks: k.clicks,
      impressions: k.impressions,
      ctr: k.ctr,
      averagePosition: k.averagePosition,
      metricSemantics: {
        positionIsAverage: true as const,
        ctrIsRatio: true as const,
        missingRowIsNotZero: true as const,
      },
    }))
    const traffic = aggregateGscTraffic(rows)
    return NextResponse.json({
      gsc: {
        dataState: connection.dataState,
        propertyRef: connection.propertyRef,
        ...traffic,
        averagePosition: aggregateGscAveragePosition(rows),
        averagePositionLabel: 'GSC average position (not fixed rank)',
      },
    })
  } catch (error) {
    if (error instanceof SeoApiError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.status })
    }
    console.error('seo performance GET failed', error)
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Unable to load SEO performance' }, { status: 500 })
  }
}

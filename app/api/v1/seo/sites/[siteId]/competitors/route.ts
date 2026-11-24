import { NextResponse } from 'next/server'
import { seoRouteError } from '@/lib/platform/seo/http'
import { prisma } from '@/lib/db'
import { requireSeoApiActor, SeoApiError } from '@/lib/platform/seo/route-auth'

type Params = { params: Promise<{ siteId: string }> }

export async function GET(_request: Request, { params }: Params) {
  try {
    const actor = await requireSeoApiActor('seo.read')
    const { siteId } = await params
    const [markets, competitors] = await Promise.all([
      prisma.competitorMarket.findMany({ where: { managedSiteId: siteId, customerAccountId: actor.customerAccountId } }),
      prisma.competitorProfile.findMany({
        where: { managedSiteId: siteId, customerAccountId: actor.customerAccountId, excluded: false },
        orderBy: { rankScore: 'desc' },
        take: 5,
      }),
    ])
    return NextResponse.json({ markets, competitors })
  } catch (error) {
    return seoRouteError(error)
  }
}

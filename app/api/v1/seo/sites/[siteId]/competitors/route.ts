import { NextResponse } from 'next/server'
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
    if (error instanceof SeoApiError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.status })
    }
    console.error('seo competitors GET failed', error)
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Unable to load SEO competitors' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { seoRouteError } from '@/lib/platform/seo/http'
import { SEO_LIST_DEFAULT_TAKE, SEO_LIST_MAX_TAKE } from '@/config/seo-backend'
import { prisma } from '@/lib/db'
import { requireSeoApiActor, SeoApiError } from '@/lib/platform/seo/route-auth'

type Params = { params: Promise<{ siteId: string }> }

export async function GET(request: Request, { params }: Params) {
  try {
    const actor = await requireSeoApiActor('seo.read')
    const { siteId } = await params
    const url = new URL(request.url)
    const take = Math.min(Math.max(Number(url.searchParams.get('take') ?? SEO_LIST_DEFAULT_TAKE), 1), SEO_LIST_MAX_TAKE)
    const status = url.searchParams.get('status') ?? undefined
    const pages = await prisma.sitePageInventory.findMany({
      where: {
        managedSiteId: siteId,
        customerAccountId: actor.customerAccountId,
        ...(status ? { status: status as never } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      take,
    })
    return NextResponse.json({ pages })
  } catch (error) {
    return seoRouteError(error)
  }
}

import { NextResponse } from 'next/server'
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
    const opportunities = await prisma.seoOpportunity.findMany({
      where: { managedSiteId: siteId, customerAccountId: actor.customerAccountId },
      orderBy: { priorityScore: 'desc' },
      take,
    })
    return NextResponse.json({ opportunities })
  } catch (error) {
    if (error instanceof SeoApiError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.status })
    }
    console.error('seo opportunities GET failed', error)
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Unable to load SEO opportunities' }, { status: 500 })
  }
}

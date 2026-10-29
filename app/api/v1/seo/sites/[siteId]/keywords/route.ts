import { NextResponse } from 'next/server'
import { listGscKeywordsForSite } from '@/lib/platform/seo/keyword-list-service'
import { requireSeoApiActor, SeoApiError } from '@/lib/platform/seo/route-auth'
import { seoResultHttpStatus } from '@/lib/platform/seo/seo-api-map'

type Params = { params: Promise<{ siteId: string }> }

export async function GET(request: Request, { params }: Params) {
  try {
    const actor = await requireSeoApiActor('seo.read')
    const { siteId } = await params
    const url = new URL(request.url)
    const take = Number(url.searchParams.get('take') ?? undefined)
    const cursor = url.searchParams.get('cursor') ?? undefined
    const search = url.searchParams.get('q') ?? url.searchParams.get('search') ?? undefined

    const listed = await listGscKeywordsForSite({
      customerAccountId: actor.customerAccountId,
      managedSiteId: siteId,
      take: Number.isFinite(take) ? take : undefined,
      cursor,
      search,
    })
    if (!listed.ok) {
      return NextResponse.json({ code: listed.code, message: listed.message }, { status: seoResultHttpStatus(listed.code) })
    }

    const body: {
      gsc: typeof listed.value.gsc
      keywords: typeof listed.value.keywords
      limitations: string[]
      nextCursor?: string
    } = {
      gsc: listed.value.gsc,
      keywords: listed.value.keywords,
      limitations: listed.value.limitations,
    }
    if (listed.value.nextCursor) body.nextCursor = listed.value.nextCursor
    return NextResponse.json(body)
  } catch (error) {
    if (error instanceof SeoApiError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.status })
    }
    console.error('seo keywords GET failed', error)
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Unable to load SEO keywords' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { listSeoOpportunitiesForSite } from '@/lib/platform/seo/opportunity-list-service'
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
    const state = url.searchParams.get('state') ?? undefined
    const severity = url.searchParams.get('severity') ?? undefined
    const confidence = url.searchParams.get('confidence') ?? undefined

    const listed = await listSeoOpportunitiesForSite({
      customerAccountId: actor.customerAccountId,
      managedSiteId: siteId,
      take: Number.isFinite(take) ? take : undefined,
      cursor,
      state,
      severity,
      confidence,
    })
    if (!listed.ok) {
      return NextResponse.json({ code: listed.code, message: listed.message }, { status: seoResultHttpStatus(listed.code) })
    }

    const body: { opportunities: typeof listed.value.opportunities; nextCursor?: string } = {
      opportunities: listed.value.opportunities,
    }
    if (listed.value.nextCursor) body.nextCursor = listed.value.nextCursor
    return NextResponse.json(body)
  } catch (error) {
    if (error instanceof SeoApiError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.status })
    }
    console.error('seo opportunities GET failed', error)
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Unable to load SEO opportunities' }, { status: 500 })
  }
}

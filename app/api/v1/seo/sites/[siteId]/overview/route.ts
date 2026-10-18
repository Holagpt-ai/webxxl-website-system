import { NextResponse } from 'next/server'
import { seoResultHttpStatus } from '@/lib/platform/seo/seo-api-map'
import { loadSeoSiteOverview } from '@/lib/platform/seo/seo-overview-service'
import { requireSeoApiActor, SeoApiError } from '@/lib/platform/seo/route-auth'

type Params = { params: Promise<{ siteId: string }> }

export async function GET(_request: Request, { params }: Params) {
  try {
    const actor = await requireSeoApiActor('seo.read')
    const { siteId } = await params
    const overview = await loadSeoSiteOverview({
      customerAccountId: actor.customerAccountId,
      managedSiteId: siteId,
    })
    if (!overview.ok) {
      return NextResponse.json({ code: overview.code, message: overview.message }, { status: seoResultHttpStatus(overview.code) })
    }
    return NextResponse.json({ overview: overview.value })
  } catch (error) {
    if (error instanceof SeoApiError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.status })
    }
    console.error('seo overview GET failed', error)
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Unable to load SEO overview' }, { status: 500 })
  }
}

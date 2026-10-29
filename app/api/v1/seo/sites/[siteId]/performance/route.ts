import { NextResponse } from 'next/server'
import { loadGscStoredSiteBundle } from '@/lib/platform/seo/gsc-site-read'
import { requireSeoApiActor, SeoApiError } from '@/lib/platform/seo/route-auth'
import { seoResultHttpStatus } from '@/lib/platform/seo/seo-api-map'

type Params = { params: Promise<{ siteId: string }> }

export async function GET(_request: Request, { params }: Params) {
  try {
    const actor = await requireSeoApiActor('seo.read')
    const { siteId } = await params
    const bundle = await loadGscStoredSiteBundle({
      customerAccountId: actor.customerAccountId,
      managedSiteId: siteId,
    })
    if (!bundle.ok) {
      return NextResponse.json({ code: bundle.code, message: bundle.message }, { status: seoResultHttpStatus(bundle.code) })
    }
    return NextResponse.json({ gsc: bundle.value.performance, limitations: bundle.value.limitations })
  } catch (error) {
    if (error instanceof SeoApiError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.status })
    }
    console.error('seo performance GET failed', error)
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Unable to load SEO performance' }, { status: 500 })
  }
}

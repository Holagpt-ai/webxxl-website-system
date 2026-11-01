import { NextResponse } from 'next/server'
import { isGoogleProviderReadinessEnabled } from '@/config/google-integration'
import { loadGoogleConnectionsForAccount } from '@/lib/platform/google/prisma-load'
import { assessGoogleSiteReadiness } from '@/lib/platform/google/readiness-assess'
import { requireSeoApiActor, SeoApiError } from '@/lib/platform/seo/route-auth'
import { requireManagedSiteInAccount } from '@/lib/platform/seo/site-scope'

type Params = { params: Promise<{ siteId: string }> }

export async function GET(_request: Request, { params }: Params) {
  try {
    if (!isGoogleProviderReadinessEnabled()) {
      return NextResponse.json(
        { code: 'NOT_CONFIGURED', message: 'Google provider readiness module disabled' },
        { status: 503 },
      )
    }
    const actor = await requireSeoApiActor('seo.read')
    const { siteId } = await params
    const site = await requireManagedSiteInAccount({
      siteId,
      customerAccountId: actor.customerAccountId,
    })
    if (!site.ok) {
      return NextResponse.json({ code: site.code, message: site.message }, { status: site.code === 'NOT_FOUND' ? 404 : 400 })
    }
    const connections = await loadGoogleConnectionsForAccount({
      customerAccountId: actor.customerAccountId,
      managedSiteId: siteId,
    })
    let siteCanonicalUrl: string | null = null
    if (site.value.domain) {
      siteCanonicalUrl = site.value.domain.startsWith('http') ? site.value.domain : `https://${site.value.domain}`
    }
    const dto = assessGoogleSiteReadiness({
      customerAccountId: actor.customerAccountId,
      managedSiteId: siteId,
      authorizedHosts: site.value.authorizedHosts,
      siteCanonicalUrl,
      connections,
    })
    return NextResponse.json(dto)
  } catch (error) {
    if (error instanceof SeoApiError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.status })
    }
    console.error('seo google readiness GET failed', error)
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Unable to assess Google readiness' }, { status: 500 })
  }
}

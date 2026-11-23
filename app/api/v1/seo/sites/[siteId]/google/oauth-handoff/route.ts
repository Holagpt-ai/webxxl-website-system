import { buildGoogleOAuthHandoffContract } from '@/lib/platform/google/oauth-handoff-contract'
import { seoRouteError } from '@/lib/platform/seo/http'
import { NextResponse } from 'next/server'
import { requireSeoApiActor } from '@/lib/platform/seo/route-auth'
import { requireManagedSiteInAccount } from '@/lib/platform/seo/site-scope'

type Params = { params: Promise<{ siteId: string }> }

export async function GET(_request: Request, { params }: Params) {
  try {
    const actor = await requireSeoApiActor('seo.read')
    const { siteId } = await params
    const site = await requireManagedSiteInAccount({
      siteId,
      customerAccountId: actor.customerAccountId,
    })
    if (!site.ok) {
      return NextResponse.json({ code: site.code, message: site.message }, { status: site.code === 'NOT_FOUND' ? 404 : 400 })
    }
    let siteCanonicalUrl: string | null = null
    if (site.value.domain) {
      siteCanonicalUrl = site.value.domain.startsWith('http') ? site.value.domain : `https://${site.value.domain}`
    }
    const contract = await buildGoogleOAuthHandoffContract({
      customerAccountId: actor.customerAccountId,
      managedSiteId: siteId,
      authorizedHosts: site.value.authorizedHosts,
      siteCanonicalUrl,
    })
    return NextResponse.json(contract)
  } catch (error) {
    return seoRouteError(error)
  }
}
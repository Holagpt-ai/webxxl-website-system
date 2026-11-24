import { NextResponse } from 'next/server'
import { seoRouteError } from '@/lib/platform/seo/http'
import { listManagedSitesForAccount } from '@/lib/managed-sites/queries'
import { requireSeoApiActor, SeoApiError } from '@/lib/platform/seo/route-auth'

export async function GET() {
  try {
    const actor = await requireSeoApiActor('seo.read')
    const sites = await listManagedSitesForAccount(actor.customerAccountId)
    return NextResponse.json({
      sites: sites.map((s) => ({
        id: s.id,
        name: s.name,
        domain: s.domain,
        canonicalUrl: s.canonicalUrl,
        status: s.status,
      })),
    })
  } catch (error) {
    return seoRouteError(error)
  }
}

import { NextResponse } from 'next/server'
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
    if (error instanceof SeoApiError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.status })
    }
    console.error('seo sites GET failed', error)
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Unable to load SEO sites' }, { status: 500 })
  }
}

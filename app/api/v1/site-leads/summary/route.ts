import { NextResponse } from 'next/server'
import { getManagedSiteLeadSummary } from '@/lib/platform/site-leads/summary-service'
import { SiteLeadApiError, requireSiteLeadInboxActor } from '@/lib/platform/site-leads/route-auth'
import { siteLeadResultHttpStatus } from '@/lib/platform/site-leads/site-lead-api-map'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const actor = await requireSiteLeadInboxActor('crm.read')
    const url = new URL(request.url)
    const managedSiteId = url.searchParams.get('managedSiteId')
    const result = await getManagedSiteLeadSummary({
      customerAccountId: actor.customerAccountId,
      managedSiteId,
    })
    if (!result.ok) {
      return NextResponse.json(
        { code: result.code, message: result.message },
        { status: siteLeadResultHttpStatus(result.code) },
      )
    }
    return NextResponse.json(result.value)
  } catch (error) {
    if (error instanceof SiteLeadApiError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.status })
    }
    console.error('site-leads summary GET failed', error)
    return NextResponse.json({ code: 'ERROR', message: 'Unable to load lead summary' }, { status: 500 })
  }
}

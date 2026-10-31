import { NextResponse } from 'next/server'
import { getManagedSiteLeadForAccount } from '@/lib/platform/site-leads/list-service'
import { SiteLeadApiError, requireSiteLeadInboxActor } from '@/lib/platform/site-leads/route-auth'
import { siteLeadResultHttpStatus } from '@/lib/platform/site-leads/site-lead-api-map'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSiteLeadInboxActor('crm.read')
    const { id } = await context.params
    const result = await getManagedSiteLeadForAccount(id, actor.customerAccountId)
    if (!result.ok) {
      return NextResponse.json(
        { code: result.code, message: result.message },
        { status: siteLeadResultHttpStatus(result.code) },
      )
    }
    return NextResponse.json({ lead: result.value })
  } catch (error) {
    if (error instanceof SiteLeadApiError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.status })
    }
    console.error('site-leads GET by id failed', error)
    return NextResponse.json({ code: 'ERROR', message: 'Unable to load lead' }, { status: 500 })
  }
}

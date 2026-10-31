import { NextResponse } from 'next/server'
import { qualifySiteLead } from '@/lib/platform/site-leads/workflow-service'
import { SiteLeadApiError, requireSiteLeadInboxActor } from '@/lib/platform/site-leads/route-auth'
import { siteLeadResultHttpStatus } from '@/lib/platform/site-leads/site-lead-api-map'

export const dynamic = 'force-dynamic'

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSiteLeadInboxActor('crm.write')
    const { id } = await context.params
    const result = await qualifySiteLead(id, actor.customerAccountId)
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
    console.error('site-leads qualify failed', error)
    return NextResponse.json({ code: 'ERROR', message: 'Unable to qualify lead' }, { status: 500 })
  }
}

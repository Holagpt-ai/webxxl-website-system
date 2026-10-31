import { NextResponse } from 'next/server'
import { listManagedSiteLeads, parseSiteLeadStatusFilter } from '@/lib/platform/site-leads/list-service'
import { SiteLeadApiError, requireSiteLeadInboxActor } from '@/lib/platform/site-leads/route-auth'
import { siteLeadResultHttpStatus } from '@/lib/platform/site-leads/site-lead-api-map'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const actor = await requireSiteLeadInboxActor('crm.read')
    const url = new URL(request.url)
    const managedSiteId = url.searchParams.get('managedSiteId')
    const status = parseSiteLeadStatusFilter(url.searchParams.get('status'))
    const createdFromRaw = url.searchParams.get('createdFrom')
    const createdToRaw = url.searchParams.get('createdTo')
    const createdFrom = createdFromRaw ? new Date(createdFromRaw) : null
    const createdTo = createdToRaw ? new Date(createdToRaw) : null
    if (createdFrom && Number.isNaN(createdFrom.getTime())) {
      return NextResponse.json({ code: 'VALIDATION', message: 'createdFrom is invalid' }, { status: 400 })
    }
    if (createdTo && Number.isNaN(createdTo.getTime())) {
      return NextResponse.json({ code: 'VALIDATION', message: 'createdTo is invalid' }, { status: 400 })
    }
    const takeRaw = url.searchParams.get('take')
    const take = takeRaw ? Number(takeRaw) : undefined
    const result = await listManagedSiteLeads({
      customerAccountId: actor.customerAccountId,
      managedSiteId,
      statuses: status.length ? status : undefined,
      createdFrom,
      createdTo,
      cursor: url.searchParams.get('cursor'),
      take: Number.isFinite(take) ? take : undefined,
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
    console.error('site-leads GET failed', error)
    return NextResponse.json({ code: 'ERROR', message: 'Unable to list leads' }, { status: 500 })
  }
}

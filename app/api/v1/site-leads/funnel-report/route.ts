import { NextResponse } from 'next/server'
import { getManagedSiteLeadFunnelReport } from '@/lib/platform/site-leads/funnel-report-service'
import { SiteLeadReportingApiError, requireSiteLeadReportingActor } from '@/lib/platform/site-leads/reporting-auth'
import { siteLeadResultHttpStatus } from '@/lib/platform/site-leads/site-lead-api-map'
import { isPrismaMissingTableError } from '@/lib/platform/business-overview/access'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const actor = await requireSiteLeadReportingActor('crm.read')
    const url = new URL(request.url)
    const managedSiteId = url.searchParams.get('managedSiteId')
    const formReference = url.searchParams.get('formReference')
    const createdFrom = url.searchParams.get('createdFrom')
    const createdTo = url.searchParams.get('createdTo')

    const result = await getManagedSiteLeadFunnelReport({
      customerAccountId: actor.customerAccountId,
      managedSiteId,
      formReference,
      createdFromRaw: createdFrom,
      createdToRaw: createdTo,
    })
    if (!result.ok) {
      return NextResponse.json(
        { code: result.code, message: result.message },
        { status: siteLeadResultHttpStatus(result.code) },
      )
    }
    return NextResponse.json({ report: result.value })
  } catch (error) {
    if (error instanceof SiteLeadReportingApiError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.status })
    }
    if (isPrismaMissingTableError(error)) {
      return NextResponse.json(
        {
          code: 'NOT_CONFIGURED',
          message: 'Managed-site lead reporting is unavailable until lead intake migrations are applied',
        },
        { status: 503 },
      )
    }
    console.error('site-leads funnel-report GET failed', error)
    return NextResponse.json({ code: 'ERROR', message: 'Unable to load lead funnel report' }, { status: 500 })
  }
}

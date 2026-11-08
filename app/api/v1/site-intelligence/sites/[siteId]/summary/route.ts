import { NextResponse } from 'next/server'
import { AuthError, requireCustomerMembership } from '@/lib/portal/authz'
import { parseAnalyticsDateRange } from '@/lib/platform/analytics/date-range'
import { getSiteIntelligenceSummary } from '@/lib/platform/site-intelligence/service'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ siteId: string }> }

export async function GET(request: Request, { params }: Params) {
  try {
    const portal = await requireCustomerMembership()
    const { siteId } = await params
    const url = new URL(request.url)
    const requestedAccountId = url.searchParams.get('customerAccountId')
    if (requestedAccountId && requestedAccountId !== portal.customerAccount.id) {
      return NextResponse.json(
        { code: 'FORBIDDEN', message: 'Cannot read site intelligence for a different customer account' },
        { status: 403 },
      )
    }
    const rangeResult = parseAnalyticsDateRange(url.searchParams)
    if (!rangeResult.ok) {
      return NextResponse.json(
        { code: rangeResult.error, message: rangeResult.message },
        { status: rangeResult.error === 'VALIDATION' ? 400 : 503 },
      )
    }
    const summary = await getSiteIntelligenceSummary({
      portal,
      managedSiteId: siteId,
      range: rangeResult.value,
    })
    if (!summary.ok) {
      return NextResponse.json({ code: summary.code, message: summary.message }, { status: 404 })
    }
    return NextResponse.json({ summary: summary.value })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, { status: 401 })
    }
    console.error('site-intelligence summary GET failed', error)
    return NextResponse.json({ code: 'ERROR', message: 'Unable to load site intelligence summary' }, { status: 500 })
  }
}

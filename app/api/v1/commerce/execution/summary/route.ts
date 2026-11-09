import { NextResponse } from 'next/server'
import { AuthError, requireCustomerMembership } from '@/lib/portal/authz'
import { getCommerceExecutionSummary } from '@/lib/platform/commerce-execution/service'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const portal = await requireCustomerMembership()
    const url = new URL(request.url)
    const requestedAccountId = url.searchParams.get('customerAccountId')
    if (requestedAccountId && requestedAccountId !== portal.customerAccount.id) {
      return NextResponse.json(
        { code: 'FORBIDDEN', message: 'Cannot read commerce execution for a different customer account' },
        { status: 403 },
      )
    }
    const managedSiteId = url.searchParams.get('managedSiteId')
    const billingGroupId = url.searchParams.get('billingGroupId')
    const summary = await getCommerceExecutionSummary({
      portal,
      managedSiteId,
      billingGroupId,
    })
    if (!summary.ok) {
      return NextResponse.json({ code: summary.code, message: summary.message }, { status: 404 })
    }
    return NextResponse.json({ summary: summary.value })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, { status: 401 })
    }
    console.error('commerce execution summary GET failed', error)
    return NextResponse.json(
      { code: 'ERROR', message: 'Unable to load commerce execution summary' },
      { status: 500 },
    )
  }
}

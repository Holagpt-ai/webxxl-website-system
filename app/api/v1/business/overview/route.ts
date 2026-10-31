import { NextResponse } from 'next/server'
import { AuthError, requireCustomerMembership } from '@/lib/portal/authz'
import { getBusinessOverview } from '@/lib/platform/business-overview/service'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const portal = await requireCustomerMembership()
    const url = new URL(request.url)
    const requestedAccountId = url.searchParams.get('customerAccountId')
    if (requestedAccountId && requestedAccountId !== portal.customerAccount.id) {
      return NextResponse.json(
        { code: 'FORBIDDEN', message: 'Cannot read business overview for a different customer account' },
        { status: 403 },
      )
    }
    const overview = await getBusinessOverview(portal)
    return NextResponse.json({ overview })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, { status: 401 })
    }
    console.error('business overview GET failed', error)
    return NextResponse.json({ code: 'ERROR', message: 'Unable to load business overview' }, { status: 500 })
  }
}

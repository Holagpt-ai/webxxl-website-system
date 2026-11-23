import { NextResponse } from 'next/server'
import { AuthError, requireCustomerMembership } from '@/lib/portal/authz'
import { getCustomerDashboardContext } from '@/lib/platform/customer-dashboard/context-service'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const portal = await requireCustomerMembership()
    const url = new URL(request.url)
    const requestedAccountId = url.searchParams.get('customerAccountId')
    if (requestedAccountId && requestedAccountId !== portal.customerAccount.id) {
      return NextResponse.json(
        { code: 'FORBIDDEN', message: 'Cannot read dashboard context for a different customer account' },
        { status: 403 },
      )
    }
    const context = await getCustomerDashboardContext(portal)
    return NextResponse.json({ context })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, { status: 401 })
    }
    console.error('portal dashboard-context GET failed', error)
    return NextResponse.json({ code: 'ERROR', message: 'Unable to load dashboard context' }, { status: 500 })
  }
}
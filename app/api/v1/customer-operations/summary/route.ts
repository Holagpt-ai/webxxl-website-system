import { NextResponse } from 'next/server'
import { AuthError, requireCustomerMembership } from '@/lib/portal/authz'
import { getCustomerOperationsSummary } from '@/lib/platform/customer-operations/service'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const portal = await requireCustomerMembership()
    const url = new URL(request.url)
    const requestedAccountId = url.searchParams.get('customerAccountId')
    if (requestedAccountId && requestedAccountId !== portal.customerAccount.id) {
      return NextResponse.json(
        { code: 'FORBIDDEN', message: 'Cannot read customer operations for a different customer account' },
        { status: 403 },
      )
    }
    const summary = await getCustomerOperationsSummary(portal)
    return NextResponse.json({ summary })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, { status: 401 })
    }
    console.error('customer-operations summary GET failed', error)
    return NextResponse.json({ code: 'ERROR', message: 'Unable to load customer operations summary' }, { status: 500 })
  }
}

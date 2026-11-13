import { NextResponse } from 'next/server'
import { AuthError, requireStaff } from '@/lib/portal/authz'
import { getAdminOperationsSummary } from '@/lib/platform/admin-operations/service'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const staff = await requireStaff()
    const url = new URL(request.url)
    const customerAccountId = url.searchParams.get('customerAccountId')
    const managedSiteId = url.searchParams.get('managedSiteId')
    const summary = await getAdminOperationsSummary({
      staffUser: staff,
      customerAccountId,
      managedSiteId,
    })
    return NextResponse.json({ summary })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Staff access required' }, { status: 401 })
    }
    console.error('admin operations summary GET failed', error)
    return NextResponse.json({ code: 'ERROR', message: 'Unable to load admin operations summary' }, { status: 500 })
  }
}

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
    const result = await getAdminOperationsSummary({
      staffUser: staff,
      customerAccountId,
      managedSiteId,
    })
    if (!result.ok) {
      const status = result.code === 'NOT_FOUND' ? 404 : result.code === 'VALIDATION' ? 400 : 403
      return NextResponse.json({ code: result.code, message: result.message }, { status })
    }
    return NextResponse.json({ summary: result.value })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Staff access required' }, { status: 401 })
    }
    console.error('admin operations summary GET failed', error)
    return NextResponse.json({ code: 'ERROR', message: 'Unable to load admin operations summary' }, { status: 500 })
  }
}

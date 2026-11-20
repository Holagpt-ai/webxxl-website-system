import { NextResponse } from 'next/server'
import { AuthError, requireStaff } from '@/lib/portal/authz'
import { evaluateRuntimeDatabaseVerification } from '@/lib/platform/admin-operations/runtime-database-verification'

export const dynamic = 'force-dynamic'

/** Staff-only RELEASE-001 runtime database identity gate (no secrets in response). */
export async function GET() {
  try {
    await requireStaff()
    const result = await evaluateRuntimeDatabaseVerification(process.env)
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Staff access required' }, { status: 401 })
    }
    console.error('admin database verification GET failed', error)
    return NextResponse.json({ code: 'ERROR', message: 'Unable to verify database routing' }, { status: 500 })
  }
}
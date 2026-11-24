import { NextResponse } from 'next/server'
import { AuthError } from '@/lib/portal/authz'
import { CrmApiError } from '@/lib/platform/crm/crm-api-error'
import { crmResultHttpStatus } from '@/lib/platform/crm/crm-api-map'
import type { CrmResult } from '@/lib/platform/crm/types'

export function crmRouteError(error: unknown) {
  if (error instanceof CrmApiError) {
    return NextResponse.json({ code: error.code, message: error.message }, { status: error.status })
  }
  if (error instanceof AuthError) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, { status: 401 })
  }
  console.error('crm API failed', error)
  return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'CRM request failed' }, { status: 500 })
}

export function crmServiceResponse<T>(result: CrmResult<T>, successStatus = 200) {
  if (!result.ok) {
    return NextResponse.json(
      { code: result.code, message: result.message },
      { status: crmResultHttpStatus(result.code) },
    )
  }
  return NextResponse.json(result.value, { status: successStatus })
}
import { NextResponse } from 'next/server'
import { mktResultHttpStatus } from '@/lib/platform/marketing/mkt-api-map'
import { MktApiError } from '@/lib/platform/marketing/mkt-api-error'
import type { MktResult } from '@/lib/platform/marketing/types'

export function mktRouteError(error: unknown) {
  if (error instanceof MktApiError) {
    return NextResponse.json({ code: error.code, message: error.message }, { status: error.status })
  }
  console.error('marketing API failed', error)
  return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Marketing request failed' }, { status: 500 })
}

export function mktServiceResponse<T>(result: MktResult<T>, successStatus = 200) {
  if (!result.ok) {
    return NextResponse.json({ code: result.code, message: result.message }, { status: mktResultHttpStatus(result.code) })
  }
  return NextResponse.json(result.value, { status: successStatus })
}

import { NextResponse } from 'next/server'
import { AuthError } from '@/lib/portal/authz'
import { CommsApiError } from '@/lib/platform/comms/comms-api-error'
import { commsResultHttpStatus } from '@/lib/platform/comms/comms-api-map'
import type { CommsResult } from '@/lib/platform/comms/types'

export function commsRouteError(error: unknown) {
  if (error instanceof CommsApiError) {
    return NextResponse.json({ code: error.code, message: error.message }, { status: error.status })
  }
  if (error instanceof AuthError) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, { status: 401 })
  }
  console.error('communications API failed', error)
  return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Communications request failed' }, { status: 500 })
}

export function commsServiceResponse<T>(result: CommsResult<T>, successStatus = 200) {
  if (!result.ok) {
    return NextResponse.json(
      { code: result.code, message: result.message },
      { status: commsResultHttpStatus(result.code) },
    )
  }
  return NextResponse.json(result.value, { status: successStatus })
}
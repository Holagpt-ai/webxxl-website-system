import { NextResponse } from 'next/server'
import { AuthError } from '@/lib/portal/authz'
import { SocialApiError } from '@/lib/platform/social/route-auth'
import { socialResultHttpStatus } from '@/lib/platform/social/social-api-map'
import type { SocialResult } from '@/lib/platform/social/types'

export function socialRouteError(error: unknown) {
  if (error instanceof SocialApiError) {
    return NextResponse.json({ code: error.code, message: error.message }, { status: error.status })
  }
  if (error instanceof AuthError) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, { status: 401 })
  }
  console.error('social API failed', error)
  return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Social request failed' }, { status: 500 })
}

export function socialServiceResponse<T>(result: SocialResult<T>, successStatus = 200) {
  if (!result.ok) {
    return NextResponse.json(
      { code: result.code, message: result.message },
      { status: socialResultHttpStatus(result.code) },
    )
  }
  return NextResponse.json(result.value, { status: successStatus })
}
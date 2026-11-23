import { NextResponse } from 'next/server'
import { AuthError } from '@/lib/portal/authz'
import { SeoApiError } from '@/lib/platform/seo/seo-api-error'
import { seoResultHttpStatus } from '@/lib/platform/seo/seo-api-map'
import type { SeoResult } from '@/lib/platform/seo/types'

export function seoRouteError(error: unknown) {
  if (error instanceof SeoApiError) {
    return NextResponse.json({ code: error.code, message: error.message }, { status: error.status })
  }
  if (error instanceof AuthError) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, { status: 401 })
  }
  console.error('seo API failed', error)
  return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'SEO request failed' }, { status: 500 })
}

export function seoServiceResponse<T>(result: SeoResult<T>, successStatus = 200) {
  if (!result.ok) {
    return NextResponse.json(
      { code: result.code, message: result.message },
      { status: seoResultHttpStatus(result.code) },
    )
  }
  return NextResponse.json(result.value, { status: successStatus })
}
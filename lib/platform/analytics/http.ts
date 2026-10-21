import { NextResponse } from 'next/server'
import { isAnalyticsBackendEnabled } from '@/config/analytics-backend'
import { AuthError } from '@/lib/portal/authz'
import type { AnalyticsError } from '@/lib/platform/analytics/types'

export function analyticsDisabledResponse() {
  if (isAnalyticsBackendEnabled()) return null
  return NextResponse.json(
    { code: 'ANALYTICS_DISABLED', message: 'Analytics backend is disabled' },
    { status: 503 },
  )
}

export function analyticsStatus(error: AnalyticsError): number {
  switch (error) {
    case 'ANALYTICS_DISABLED':
    case 'PROVIDER_UNAVAILABLE':
      return 503
    case 'UNAUTHORIZED':
      return 401
    case 'FORBIDDEN':
    case 'TENANT_MISMATCH':
    case 'ENTITLEMENT_UNRESOLVED':
      return 403
    case 'VALIDATION':
      return 400
    case 'NOT_FOUND':
      return 404
    default:
      return 409
  }
}

export function analyticsResultResponse(
  result: { ok: true; value: unknown } | { ok: false; error: AnalyticsError; message?: string },
) {
  if (!result.ok) {
    return NextResponse.json(
      { code: result.error, message: result.message ?? result.error },
      { status: analyticsStatus(result.error) },
    )
  }
  return NextResponse.json(result.value)
}

export function analyticsRouteError(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json({ code: 'INTERNAL', message: 'Analytics request failed' }, { status: 500 })
}

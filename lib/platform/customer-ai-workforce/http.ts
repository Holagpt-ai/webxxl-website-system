import { NextResponse } from 'next/server'
import { isCustomerAiPilotPrepEnabled, isCustomerAiWorkforceEnabled } from '@/config/customer-ai-workforce'
import { AuthError } from '@/lib/portal/authz'
import type { CustomerAiError } from '@/lib/platform/customer-ai-workforce/types'
import type { User } from '@prisma/client'
import type { UserRole } from '@prisma/client'

export function customerAiDisabledResponse() {
  if (isCustomerAiWorkforceEnabled()) return null
  return NextResponse.json(
    { code: 'AI_WORKFORCE_DISABLED', message: 'Customer AI workforce backend is disabled' },
    { status: 503 },
  )
}

export function customerAiPilotPrepDisabledResponse() {
  const workforce = customerAiDisabledResponse()
  if (workforce) return workforce
  if (isCustomerAiPilotPrepEnabled()) return null
  return NextResponse.json(
    { code: 'EXECUTION_DISABLED', message: 'Customer AI pilot preparation is disabled' },
    { status: 503 },
  )
}

export function toCustomerAiActor(user: User): { userId: string; platformRole: UserRole } {
  return { userId: user.id, platformRole: user.role }
}

export function customerAiStatus(error: CustomerAiError): number {
  switch (error) {
    case 'AI_WORKFORCE_DISABLED':
    case 'EXECUTION_DISABLED':
      return 503
    case 'UNAUTHORIZED':
      return 401
    case 'FORBIDDEN':
    case 'TENANT_MISMATCH':
    case 'ENTITLEMENT_UNRESOLVED':
    case 'POLICY_BLOCKED':
    case 'EMERGENCY_DISABLED':
      return 403
    case 'VALIDATION':
    case 'INVALID_TRANSITION':
    case 'RATE_LIMITED':
      return 400
    case 'NOT_FOUND':
      return 404
    default:
      return 409
  }
}

export function customerAiResultResponse(result: { ok: true; value: unknown } | { ok: false; error: CustomerAiError; message?: string }) {
  if (!result.ok) {
    return NextResponse.json({ code: result.error, message: result.message ?? result.error }, { status: customerAiStatus(result.error) })
  }
  return NextResponse.json(result.value)
}

export function customerAiRouteError(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json({ code: 'INTERNAL', message: 'Customer AI request failed' }, { status: 500 })
}

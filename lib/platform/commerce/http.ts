import { NextResponse } from 'next/server'
import { isCommerceBackendEnabled } from '@/config/commerce-backend'
import { AuthError } from '@/lib/portal/authz'
import type { CommerceActor, CommerceError } from '@/lib/platform/commerce/types'
import type { User } from '@prisma/client'

export function commerceDisabledResponse() {
  if (isCommerceBackendEnabled()) return null
  return NextResponse.json({ code: 'COMMERCE_DISABLED', message: 'Commerce backend is disabled' }, { status: 503 })
}

export function toCommerceActor(user: User): CommerceActor {
  return { userId: user.id, platformRole: user.role }
}

export function commerceStatus(error: CommerceError): number {
  switch (error) {
    case 'UNAUTHORIZED':
      return 401
    case 'FORBIDDEN':
    case 'POLICY_UNRESOLVED':
    case 'TENANT_MISMATCH':
      return 403
    case 'VALIDATION':
      return 400
    case 'ORDER_NOT_FOUND':
    case 'PRICE_UNAVAILABLE':
      return 404
    case 'NOT_CONFIGURED':
    case 'PROVIDER_DISABLED':
    case 'MINT_DISABLED':
    case 'PROVISIONING_DISABLED':
      return 503
    case 'SIGNATURE_INVALID':
      return 400
    default:
      return 409
  }
}

export function commerceResultResponse(result: { ok: true; value: unknown } | { ok: false; error: CommerceError; message?: string }) {
  if (!result.ok) {
    return NextResponse.json({ code: result.error, message: result.message ?? result.error }, { status: commerceStatus(result.error) })
  }
  return NextResponse.json(result.value)
}

export function commerceRouteError(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json({ code: 'INTERNAL', message: 'Commerce request failed' }, { status: 500 })
}

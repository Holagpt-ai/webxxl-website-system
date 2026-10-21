import type { ActivationStatus } from '@/lib/platform/commerce/types'
import { setProductActivationStatus } from '@/lib/platform/commerce/portal-api'
import { commerceDisabledResponse, commerceResultResponse, commerceRouteError, toCommerceActor } from '@/lib/platform/commerce/http'
import { prismaCommerceStore } from '@/lib/platform/commerce/prisma-store'
import { requireStaff } from '@/lib/portal/authz'

type Params = { params: Promise<{ productKey: string }> }

export async function POST(request: Request, { params }: Params) {
  try {
    const disabled = commerceDisabledResponse()
    if (disabled) return disabled
    const user = await requireStaff()
    const { productKey } = await params
    const body = (await request.json()) as { status?: ActivationStatus }
    if (!body.status || !['ACTIVE', 'INACTIVE', 'DRAFT'].includes(body.status)) {
      return commerceResultResponse({ ok: false, error: 'VALIDATION' })
    }
    const result = await setProductActivationStatus(
      prismaCommerceStore,
      toCommerceActor(user),
      productKey,
      body.status,
    )
    return commerceResultResponse(result)
  } catch (error) {
    return commerceRouteError(error)
  }
}

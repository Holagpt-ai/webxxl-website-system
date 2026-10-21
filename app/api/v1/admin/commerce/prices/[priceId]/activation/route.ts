import type { ActivationStatus } from '@/lib/platform/commerce/types'
import { setPriceActivationStatus } from '@/lib/platform/commerce/portal-api'
import { commerceDisabledResponse, commerceResultResponse, commerceRouteError, toCommerceActor } from '@/lib/platform/commerce/http'
import { prismaCommerceStore } from '@/lib/platform/commerce/prisma-store'
import { requireStaff } from '@/lib/portal/authz'

type Params = { params: Promise<{ priceId: string }> }

export async function POST(request: Request, { params }: Params) {
  try {
    const disabled = commerceDisabledResponse()
    if (disabled) return disabled
    const user = await requireStaff()
    const { priceId } = await params
    const body = (await request.json()) as { status?: ActivationStatus }
    if (!body.status || !['ACTIVE', 'INACTIVE'].includes(body.status)) {
      return commerceResultResponse({ ok: false, error: 'VALIDATION' })
    }
    const result = await setPriceActivationStatus(
      prismaCommerceStore,
      toCommerceActor(user),
      priceId,
      body.status,
    )
    return commerceResultResponse(result)
  } catch (error) {
    return commerceRouteError(error)
  }
}

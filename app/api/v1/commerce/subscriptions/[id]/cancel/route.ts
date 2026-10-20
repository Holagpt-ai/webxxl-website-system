import { requestSubscriptionCancellation } from '@/lib/platform/commerce/engine'
import { commerceDisabledResponse, commerceResultResponse, commerceRouteError, toCommerceActor } from '@/lib/platform/commerce/http'
import { prismaCommerceStore } from '@/lib/platform/commerce/prisma-store'
import { requireUser } from '@/lib/portal/authz'

type Params = { params: Promise<{ id: string }> }

export async function POST(_request: Request, { params }: Params) {
  try {
    const disabled = commerceDisabledResponse()
    if (disabled) return disabled
    const user = await requireUser()
    const { id } = await params
    const result = await requestSubscriptionCancellation(prismaCommerceStore, {
      actor: toCommerceActor(user),
      subscriptionId: id,
    })
    return commerceResultResponse(result)
  } catch (error) {
    return commerceRouteError(error)
  }
}

import { listGroupOrders } from '@/lib/platform/commerce/engine'
import { commerceDisabledResponse, commerceResultResponse, commerceRouteError, toCommerceActor } from '@/lib/platform/commerce/http'
import { prismaCommerceStore } from '@/lib/platform/commerce/prisma-store'
import { requireStaff } from '@/lib/portal/authz'

export async function GET(request: Request) {
  try {
    const disabled = commerceDisabledResponse()
    if (disabled) return disabled
    const user = await requireStaff()
    const billingGroupId = new URL(request.url).searchParams.get('billingGroupId')
    if (!billingGroupId) return commerceResultResponse({ ok: false, error: 'VALIDATION' })
    const result = await listGroupOrders(prismaCommerceStore, toCommerceActor(user), billingGroupId)
    return commerceResultResponse(result)
  } catch (error) {
    return commerceRouteError(error)
  }
}

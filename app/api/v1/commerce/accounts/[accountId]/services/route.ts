import { listAccountServices } from '@/lib/platform/commerce/engine'
import { commerceDisabledResponse, commerceResultResponse, commerceRouteError, toCommerceActor } from '@/lib/platform/commerce/http'
import { prismaCommerceStore } from '@/lib/platform/commerce/prisma-store'
import { requireUser } from '@/lib/portal/authz'

type Params = { params: Promise<{ accountId: string }> }

export async function GET(request: Request, { params }: Params) {
  try {
    const disabled = commerceDisabledResponse()
    if (disabled) return disabled
    const user = await requireUser()
    const { accountId } = await params
    const billingGroupId = new URL(request.url).searchParams.get('billingGroupId') ?? undefined
    const result = await listAccountServices(prismaCommerceStore, toCommerceActor(user), accountId, billingGroupId)
    return commerceResultResponse(result)
  } catch (error) {
    return commerceRouteError(error)
  }
}

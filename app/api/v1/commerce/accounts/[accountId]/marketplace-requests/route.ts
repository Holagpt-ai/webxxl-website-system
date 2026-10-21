import { listMarketplaceRequestHistory } from '@/lib/platform/commerce/portal-api'
import { parsePageParams } from '@/lib/platform/commerce/pagination'
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
    const result = await listMarketplaceRequestHistory(prismaCommerceStore, toCommerceActor(user), {
      customerAccountId: accountId,
      page: parsePageParams(new URL(request.url).searchParams),
    })
    return commerceResultResponse(result)
  } catch (error) {
    return commerceRouteError(error)
  }
}

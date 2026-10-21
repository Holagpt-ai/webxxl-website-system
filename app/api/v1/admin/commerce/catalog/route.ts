import { listAdminCatalog } from '@/lib/platform/commerce/portal-api'
import { commerceDisabledResponse, commerceResultResponse, commerceRouteError, toCommerceActor } from '@/lib/platform/commerce/http'
import { prismaCommerceStore } from '@/lib/platform/commerce/prisma-store'
import { requireStaff } from '@/lib/portal/authz'

export async function GET() {
  try {
    const disabled = commerceDisabledResponse()
    if (disabled) return disabled
    const user = await requireStaff()
    const result = await listAdminCatalog(prismaCommerceStore, toCommerceActor(user))
    return commerceResultResponse(result)
  } catch (error) {
    return commerceRouteError(error)
  }
}

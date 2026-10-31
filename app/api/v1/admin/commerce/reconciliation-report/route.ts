import { getAdminCommerceReconciliationReport } from '@/lib/platform/commerce/portal-api'
import { COMMERCE_RECONCILIATION_DEFAULT_LIMIT } from '@/lib/platform/commerce/reconciliation-report'
import { commerceDisabledResponse, commerceResultResponse, commerceRouteError, toCommerceActor } from '@/lib/platform/commerce/http'
import { prismaCommerceStore } from '@/lib/platform/commerce/prisma-store'
import { requireUser } from '@/lib/portal/authz'

export async function GET(request: Request) {
  try {
    const disabled = commerceDisabledResponse()
    if (disabled) return disabled
    const user = await requireUser()
    const url = new URL(request.url)
    const billingGroupId = url.searchParams.get('billingGroupId')
    if (!billingGroupId) return commerceResultResponse({ ok: false, error: 'VALIDATION' })
    const limitRaw = url.searchParams.get('limit')
    const limit = limitRaw
      ? Math.min(Math.max(1, Number(limitRaw) || COMMERCE_RECONCILIATION_DEFAULT_LIMIT), COMMERCE_RECONCILIATION_DEFAULT_LIMIT)
      : COMMERCE_RECONCILIATION_DEFAULT_LIMIT
    const result = await getAdminCommerceReconciliationReport(prismaCommerceStore, toCommerceActor(user), billingGroupId, limit)
    return commerceResultResponse(result)
  } catch (error) {
    return commerceRouteError(error)
  }
}

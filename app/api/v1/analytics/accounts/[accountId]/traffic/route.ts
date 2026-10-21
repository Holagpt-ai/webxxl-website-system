import { getAnalyticsTraffic } from '@/lib/platform/analytics/api'
import { analyticsResultResponse, analyticsRouteError } from '@/lib/platform/analytics/http'
import { prismaAnalyticsStore } from '@/lib/platform/analytics/prisma-store'
import { parseAnalyticsRouteContext } from '@/lib/platform/analytics/route-context'

type Params = { params: Promise<{ accountId: string }> }

export async function GET(request: Request, { params }: Params) {
  try {
    const { accountId } = await params
    const parsed = await parseAnalyticsRouteContext(request, accountId)
    if (!parsed.ok) return parsed.response
    const result = await getAnalyticsTraffic(
      prismaAnalyticsStore,
      parsed.ctx.actor,
      parsed.ctx.customerAccountId,
      parsed.ctx.range,
      parsed.ctx.managedSiteId,
    )
    return analyticsResultResponse(result)
  } catch (error) {
    return analyticsRouteError(error)
  }
}

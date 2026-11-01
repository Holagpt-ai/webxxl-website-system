import { buildGoogleAccountReadiness } from '@/lib/platform/google/account-readiness-service'
import { analyticsRouteError } from '@/lib/platform/analytics/http'
import { parseAnalyticsRouteContextNoRange } from '@/lib/platform/analytics/route-context'

type Params = { params: Promise<{ accountId: string }> }

export async function GET(request: Request, { params }: Params) {
  try {
    const { accountId } = await params
    const parsed = await parseAnalyticsRouteContextNoRange(request, accountId)
    if (!parsed.ok) return parsed.response

    const result = await buildGoogleAccountReadiness({
      customerAccountId: parsed.ctx.customerAccountId,
      managedSiteId: parsed.ctx.managedSiteId,
    })
    if (!result.ok) {
      return Response.json({ code: result.code, message: result.message }, { status: result.status })
    }
    return Response.json(result.value)
  } catch (error) {
    return analyticsRouteError(error)
  }
}

import { mktRouteError, mktServiceResponse } from '@/lib/platform/marketing/api-response'
import { requireMktCrmAudienceActor } from '@/lib/platform/marketing/crm-audience-route-auth'
import { previewCrmSegmentAudience } from '@/lib/platform/marketing/crm-segment-audience-service'

type RouteContext = { params: Promise<{ segmentId: string }> }

export async function POST(_request: Request, context: RouteContext) {
  try {
    const actor = await requireMktCrmAudienceActor('marketing.read')
    const { segmentId } = await context.params
    const preview = await previewCrmSegmentAudience(actor.customerAccountId, segmentId)
    return mktServiceResponse(preview)
  } catch (error) {
    return mktRouteError(error)
  }
}

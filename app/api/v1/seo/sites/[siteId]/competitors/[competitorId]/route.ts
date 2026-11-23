import { getCompetitorIntelligenceForSite } from '@/lib/platform/seo/competitor-intelligence-service'
import { seoRouteError, seoServiceResponse } from '@/lib/platform/seo/http'
import { requireSeoApiActor } from '@/lib/platform/seo/route-auth'

type Params = { params: Promise<{ siteId: string; competitorId: string }> }

export async function GET(request: Request, { params }: Params) {
  try {
    const actor = await requireSeoApiActor('seo.read')
    const { siteId, competitorId } = await params
    const url = new URL(request.url)
    const observationTake = Number(url.searchParams.get('take') ?? undefined)
    const result = await getCompetitorIntelligenceForSite({
      customerAccountId: actor.customerAccountId,
      managedSiteId: siteId,
      competitorId,
      observationTake: Number.isFinite(observationTake) ? observationTake : undefined,
    })
    return seoServiceResponse(result)
  } catch (error) {
    return seoRouteError(error)
  }
}
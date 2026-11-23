import { getKeywordIntelligenceForSite } from '@/lib/platform/seo/keyword-intelligence-service'
import { seoRouteError, seoServiceResponse } from '@/lib/platform/seo/http'
import { requireSeoApiActor } from '@/lib/platform/seo/route-auth'

type Params = { params: Promise<{ siteId: string }> }

export async function GET(request: Request, { params }: Params) {
  try {
    const actor = await requireSeoApiActor('seo.read')
    const { siteId } = await params
    const url = new URL(request.url)
    const query = url.searchParams.get('query') ?? url.searchParams.get('q') ?? ''
    const page = url.searchParams.get('page')
    const date = url.searchParams.get('date')
    const result = await getKeywordIntelligenceForSite({
      customerAccountId: actor.customerAccountId,
      managedSiteId: siteId,
      query,
      page,
      date,
    })
    return seoServiceResponse(result)
  } catch (error) {
    return seoRouteError(error)
  }
}
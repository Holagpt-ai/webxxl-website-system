import { listSeoCrawlRunsForSite } from '@/lib/platform/seo/crawl-run-read-service'
import { seoRouteError, seoServiceResponse } from '@/lib/platform/seo/http'
import { requireSeoApiActor } from '@/lib/platform/seo/route-auth'

type Params = { params: Promise<{ siteId: string }> }

export async function GET(_request: Request, { params }: Params) {
  try {
    const actor = await requireSeoApiActor('seo.read')
    const { siteId } = await params
    const result = await listSeoCrawlRunsForSite({
      customerAccountId: actor.customerAccountId,
      managedSiteId: siteId,
    })
    return seoServiceResponse(result)
  } catch (error) {
    return seoRouteError(error)
  }
}
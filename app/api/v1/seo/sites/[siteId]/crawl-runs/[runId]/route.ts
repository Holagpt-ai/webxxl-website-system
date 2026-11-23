import { getSeoCrawlRunResult } from '@/lib/platform/seo/crawl-run-read-service'
import { seoRouteError, seoServiceResponse } from '@/lib/platform/seo/http'
import { requireSeoApiActor } from '@/lib/platform/seo/route-auth'

type Params = { params: Promise<{ siteId: string; runId: string }> }

export async function GET(_request: Request, { params }: Params) {
  try {
    const actor = await requireSeoApiActor('seo.read')
    const { siteId, runId } = await params
    const result = await getSeoCrawlRunResult({
      customerAccountId: actor.customerAccountId,
      managedSiteId: siteId,
      crawlRunId: runId,
    })
    return seoServiceResponse(result)
  } catch (error) {
    return seoRouteError(error)
  }
}
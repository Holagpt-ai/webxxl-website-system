import { mktRouteError, mktServiceResponse } from '@/lib/platform/marketing/api-response'
import { prepareMarketingArtifactForRequest } from '@/lib/platform/marketing/artifact-revision-service'
import { recordMarketingUsage } from '@/lib/platform/marketing/usage-service'
import { requireMktApiActor } from '@/lib/platform/marketing/route-auth'

type Params = { params: Promise<{ id: string }> }

export async function POST(_request: Request, { params }: Params) {
  try {
    const actor = await requireMktApiActor('marketing.artifact.prepare')
    const { id } = await params
    const prepared = await prepareMarketingArtifactForRequest({
      customerAccountId: actor.customerAccountId,
      userId: actor.userId,
      requestId: id,
    })
    if (prepared.ok) {
      await recordMarketingUsage({
        customerAccountId: actor.customerAccountId,
        operation: 'artifact.prepare',
        idempotencyKey: `prepare:${id}`,
      })
    }
    return mktServiceResponse(prepared, 201)
  } catch (error) {
    return mktRouteError(error)
  }
}

import { NextResponse } from 'next/server'
import { mktRouteError, mktServiceResponse } from '@/lib/platform/marketing/api-response'
import { submitMarketingArtifactReview } from '@/lib/platform/marketing/approval-service'
import { requireMktApiActor } from '@/lib/platform/marketing/route-auth'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params) {
  try {
    const actor = await requireMktApiActor('marketing.artifact.review')
    const { id } = await params
    const body = (await request.json()) as { revisionHash?: string; intendedAction?: string; allowedChannel?: string }
    if (!body.revisionHash || !body.intendedAction) {
      return NextResponse.json({ code: 'VALIDATION', message: 'revisionHash and intendedAction required' }, { status: 400 })
    }
    const submitted = await submitMarketingArtifactReview({
      customerAccountId: actor.customerAccountId,
      userId: actor.userId,
      artifactId: id,
      revisionHash: body.revisionHash,
      intendedAction: body.intendedAction,
      allowedChannel: body.allowedChannel,
    })
    return mktServiceResponse(submitted, 201)
  } catch (error) {
    return mktRouteError(error)
  }
}

import { NextResponse } from 'next/server'
import { mktRouteError, mktServiceResponse } from '@/lib/platform/marketing/api-response'
import { decideMarketingArtifactReview } from '@/lib/platform/marketing/approval-service'
import { requireMktApiActor } from '@/lib/platform/marketing/route-auth'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params) {
  try {
    const actor = await requireMktApiActor('marketing.artifact.review')
    const { id } = await params
    const body = (await request.json()) as { decision?: 'APPROVED' | 'REJECTED' }
    if (!body.decision) {
      return NextResponse.json({ code: 'VALIDATION', message: 'decision required' }, { status: 400 })
    }
    const decided = await decideMarketingArtifactReview({
      customerAccountId: actor.customerAccountId,
      reviewerUserId: actor.userId,
      reviewId: id,
      decision: body.decision,
      actorType: 'USER',
    })
    return mktServiceResponse(decided)
  } catch (error) {
    return mktRouteError(error)
  }
}

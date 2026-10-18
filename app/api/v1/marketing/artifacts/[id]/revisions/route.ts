import { NextResponse } from 'next/server'
import { mktRouteError, mktServiceResponse } from '@/lib/platform/marketing/api-response'
import { createMarketingArtifactRevision } from '@/lib/platform/marketing/artifact-revision-service'
import { requireMktApiActor } from '@/lib/platform/marketing/route-auth'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params) {
  try {
    const actor = await requireMktApiActor('marketing.artifact.prepare')
    const { id } = await params
    const body = (await request.json()) as { structuredContent?: Record<string, unknown> }
    if (!body.structuredContent) {
      return NextResponse.json({ code: 'VALIDATION', message: 'structuredContent required' }, { status: 400 })
    }
    const revised = await createMarketingArtifactRevision({
      customerAccountId: actor.customerAccountId,
      userId: actor.userId,
      artifactId: id,
      structuredContent: body.structuredContent,
    })
    return mktServiceResponse(revised, 201)
  } catch (error) {
    return mktRouteError(error)
  }
}

import { NextResponse } from 'next/server'
import { listMarketingArtifacts } from '@/lib/platform/marketing/artifact-list-service'
import { mktRouteError } from '@/lib/platform/marketing/api-response'
import { mktResultHttpStatus } from '@/lib/platform/marketing/mkt-api-map'
import { requireMktApiActor } from '@/lib/platform/marketing/route-auth'

export async function GET(request: Request) {
  try {
    const actor = await requireMktApiActor('marketing.read')
    const url = new URL(request.url)
    const take = Number(url.searchParams.get('take') ?? undefined)
    const cursor = url.searchParams.get('cursor') ?? undefined
    const managedSiteId = url.searchParams.get('managedSiteId') ?? undefined
    const marketingRequestId = url.searchParams.get('marketingRequestId') ?? url.searchParams.get('requestId') ?? undefined
    const artifactType = url.searchParams.get('artifactType') ?? undefined
    const reviewStatus = url.searchParams.get('reviewStatus') ?? undefined

    const listed = await listMarketingArtifacts({
      customerAccountId: actor.customerAccountId,
      take: Number.isFinite(take) ? take : undefined,
      cursor,
      managedSiteId,
      marketingRequestId,
      artifactType,
      reviewStatus,
    })
    if (!listed.ok) {
      return NextResponse.json({ code: listed.code, message: listed.message }, { status: mktResultHttpStatus(listed.code) })
    }
    const body: { artifacts: typeof listed.value.artifacts; nextCursor?: string } = {
      artifacts: listed.value.artifacts,
    }
    if (listed.value.nextCursor) body.nextCursor = listed.value.nextCursor
    return NextResponse.json(body)
  } catch (error) {
    return mktRouteError(error)
  }
}

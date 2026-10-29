import { NextResponse } from 'next/server'
import { listMarketingReviews } from '@/lib/platform/marketing/review-list-service'
import { mktRouteError } from '@/lib/platform/marketing/api-response'
import { mktResultHttpStatus } from '@/lib/platform/marketing/mkt-api-map'
import { hasMarketingPermission } from '@/lib/platform/marketing/permissions'
import { requireMktApiActor } from '@/lib/platform/marketing/route-auth'

export async function GET(request: Request) {
  try {
    const actor = await requireMktApiActor('marketing.read')
    const url = new URL(request.url)
    const take = Number(url.searchParams.get('take') ?? undefined)
    const cursor = url.searchParams.get('cursor') ?? undefined
    const managedSiteId = url.searchParams.get('managedSiteId') ?? undefined
    const marketingRequestId = url.searchParams.get('marketingRequestId') ?? url.searchParams.get('requestId') ?? undefined
    const marketingArtifactId = url.searchParams.get('marketingArtifactId') ?? url.searchParams.get('artifactId') ?? undefined
    const status = url.searchParams.get('status') ?? undefined

    const viewerCanDecide = hasMarketingPermission(
      { membershipRole: actor.membershipRole, isStaff: actor.isStaff },
      'marketing.artifact.review',
    )

    const listed = await listMarketingReviews({
      customerAccountId: actor.customerAccountId,
      take: Number.isFinite(take) ? take : undefined,
      cursor,
      managedSiteId,
      marketingRequestId,
      marketingArtifactId,
      status,
      viewerCanDecide,
    })
    if (!listed.ok) {
      return NextResponse.json({ code: listed.code, message: listed.message }, { status: mktResultHttpStatus(listed.code) })
    }
    const body: { reviews: typeof listed.value.reviews; nextCursor?: string } = {
      reviews: listed.value.reviews,
    }
    if (listed.value.nextCursor) body.nextCursor = listed.value.nextCursor
    return NextResponse.json(body)
  } catch (error) {
    return mktRouteError(error)
  }
}

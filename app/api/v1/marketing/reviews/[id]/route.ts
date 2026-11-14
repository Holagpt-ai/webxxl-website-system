import { NextResponse } from 'next/server'
import { isMktApprovalWorkflowEnabled } from '@/config/mkt-backend'
import { getMarketingReviewForAccount } from '@/lib/platform/marketing/review-list-service'
import { mktRouteError } from '@/lib/platform/marketing/api-response'
import { mktResultHttpStatus } from '@/lib/platform/marketing/mkt-api-map'
import { hasMarketingPermission } from '@/lib/platform/marketing/permissions'
import { requireMktApiActor } from '@/lib/platform/marketing/route-auth'

type Params = { params: Promise<{ id: string }> }

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: Params) {
  try {
    const actor = await requireMktApiActor('marketing.read')
    const { id } = await params
    const viewerCanDecide = hasMarketingPermission(
      { membershipRole: actor.membershipRole, isStaff: actor.isStaff },
      'marketing.artifact.review',
    )
    const result = await getMarketingReviewForAccount({
      customerAccountId: actor.customerAccountId,
      reviewId: id,
      viewerCanDecide,
      approvalWorkflowEnabled: isMktApprovalWorkflowEnabled(),
    })
    if (!result.ok) {
      return NextResponse.json({ code: result.code, message: result.message }, { status: mktResultHttpStatus(result.code) })
    }
    return NextResponse.json({ review: result.value })
  } catch (error) {
    return mktRouteError(error)
  }
}
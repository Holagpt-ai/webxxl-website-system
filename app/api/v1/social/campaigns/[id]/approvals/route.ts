import { NextResponse } from 'next/server'
import { listSocialCampaignApprovalsPersist } from '@/lib/platform/social/approval-persist-service'
import { requireSocialApiActor, SocialApiError } from '@/lib/platform/social/route-auth'
import { socialResultHttpStatus } from '@/lib/platform/social/social-api-map'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id: campaignId } = await params
    const actor = await requireSocialApiActor()
    const listed = await listSocialCampaignApprovalsPersist({
      campaignId,
      customerAccountId: actor.customerAccountId,
    })
    if (!listed.ok) {
      return NextResponse.json(
        { code: listed.code, message: listed.message },
        { status: socialResultHttpStatus(listed.code) },
      )
    }
    return NextResponse.json({ campaignId, approvals: listed.value })
  } catch (error) {
    if (error instanceof SocialApiError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.status })
    }
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, { status: 401 })
  }
}
import { NextResponse } from 'next/server'
import { listSocialSchedulingStatusForCampaign } from '@/lib/platform/social/prepare-guarded-scheduling-persist'
import { requireSocialApiActor, SocialApiError } from '@/lib/platform/social/route-auth'
import { socialResultHttpStatus } from '@/lib/platform/social/social-api-map'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id: campaignId } = await params
    const actor = await requireSocialApiActor()
    const status = await listSocialSchedulingStatusForCampaign({
      campaignId,
      customerAccountId: actor.customerAccountId,
    })
    if (!status.ok) {
      return NextResponse.json(
        { code: status.code, message: status.message },
        { status: socialResultHttpStatus(status.code) },
      )
    }
    return NextResponse.json(status.value)
  } catch (error) {
    if (error instanceof SocialApiError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.status })
    }
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, { status: 401 })
  }
}
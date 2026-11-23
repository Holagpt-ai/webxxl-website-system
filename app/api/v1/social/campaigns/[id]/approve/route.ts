import { NextResponse } from 'next/server'
import {
  decideSocialCampaignApprovalPersist,
  submitSocialCampaignApprovalPersist,
} from '@/lib/platform/social/approval-persist-service'
import { requireSocialApiActor, SocialApiError } from '@/lib/platform/social/route-auth'
import { socialResultHttpStatus } from '@/lib/platform/social/social-api-map'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params) {
  try {
    const { id: campaignId } = await params
    const actor = await requireSocialApiActor()
    const body = (await request.json().catch(() => ({}))) as {
      action?: 'submit' | 'decide'
      approvalId?: string
      decision?: 'APPROVED' | 'REJECTED'
    }
    const action = body.action ?? (body.decision ? 'decide' : 'submit')

    if (action === 'submit') {
      const submitted = await submitSocialCampaignApprovalPersist({
        campaignId,
        customerAccountId: actor.customerAccountId,
        actorUserId: actor.userId,
      })
      if (!submitted.ok) {
        return NextResponse.json(
          { code: submitted.code, message: submitted.message },
          { status: socialResultHttpStatus(submitted.code) },
        )
      }
      return NextResponse.json(submitted.value, { status: 201 })
    }

    if (action === 'decide') {
      if (!body.approvalId || !body.decision) {
        return NextResponse.json(
          { code: 'INVALID_BODY', message: 'approvalId and decision required for decide action' },
          { status: 400 },
        )
      }
      const decided = await decideSocialCampaignApprovalPersist({
        campaignId,
        customerAccountId: actor.customerAccountId,
        approvalId: body.approvalId,
        decision: body.decision,
        approver: {
          userId: actor.userId,
          customerAccountId: actor.customerAccountId,
          membershipRole: actor.membershipRole,
          platformRole: actor.platformRole,
        },
      })
      if (!decided.ok) {
        return NextResponse.json(
          { code: decided.code, message: decided.message },
          { status: socialResultHttpStatus(decided.code) },
        )
      }
      return NextResponse.json(decided.value, { status: 200 })
    }

    return NextResponse.json({ code: 'INVALID_BODY', message: 'action must be submit or decide' }, { status: 400 })
  } catch (error) {
    if (error instanceof SocialApiError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.status })
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ code: 'INVALID_BODY', message: 'Invalid JSON body' }, { status: 400 })
    }
    console.error('social campaign approve POST failed', error)
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Unable to process approval' }, { status: 500 })
  }
}
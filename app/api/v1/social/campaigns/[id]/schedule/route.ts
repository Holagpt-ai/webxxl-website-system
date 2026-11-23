import { NextResponse } from 'next/server'
import { isPostizLivePublishingEnabled, isSocialExecutionGatesEnabled } from '@/config/social-marketing'
import { prepareGuardedSchedulingIntentPersist } from '@/lib/platform/social/prepare-guarded-scheduling-persist'
import { requireSocialApiActor, SocialApiError } from '@/lib/platform/social/route-auth'
import { socialResultHttpStatus } from '@/lib/platform/social/social-api-map'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params) {
  try {
    const { id: campaignId } = await params
    const actor = await requireSocialApiActor()

    if (isPostizLivePublishingEnabled()) {
      return NextResponse.json(
        { code: 'PENDING_PILOT', message: 'Live scheduling route pending owner activation' },
        { status: 501 },
      )
    }

    if (!isSocialExecutionGatesEnabled()) {
      return NextResponse.json(
        {
          code: 'NOT_CONFIGURED',
          message:
            'POSTIZ_LIVE_PUBLISHING_ENABLED is false and SOCIAL_EXECUTION_GATES_ENABLED is false; enable execution gates for guarded scheduling prep.',
          intentPersisted: false,
          schedulingOccurred: false,
          publishingOccurred: false,
        },
        { status: 503 },
      )
    }

    const body = (await request.json()) as {
      channelId?: string
      approvalId?: string
      idempotencyKey?: string
      scheduledAt?: string
    }
    if (!body.channelId || !body.approvalId || !body.idempotencyKey || !body.scheduledAt) {
      return NextResponse.json(
        { code: 'INVALID_BODY', message: 'channelId, approvalId, idempotencyKey, and scheduledAt required' },
        { status: 400 },
      )
    }
    const scheduledAt = new Date(body.scheduledAt)
    if (Number.isNaN(scheduledAt.getTime())) {
      return NextResponse.json({ code: 'INVALID_BODY', message: 'scheduledAt is invalid' }, { status: 400 })
    }

    const prep = await prepareGuardedSchedulingIntentPersist({
      campaignId,
      customerAccountId: actor.customerAccountId,
      actorUserId: actor.userId,
      channelId: body.channelId,
      approvalId: body.approvalId,
      idempotencyKey: body.idempotencyKey,
      scheduledAt,
    })
    if (!prep.ok) {
      return NextResponse.json(
        { code: prep.code, message: prep.message, intentPersisted: false },
        { status: socialResultHttpStatus(prep.code) },
      )
    }

    return NextResponse.json(
      {
        campaignId,
        ...prep.value,
        intentPersisted: true,
        executionGatesEnabled: true,
        code: prep.value.dispatchBlocked.code,
        message: prep.value.dispatchBlocked.message,
      },
      { status: 202 },
    )
  } catch (error) {
    if (error instanceof SocialApiError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.status })
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ code: 'INVALID_BODY', message: 'Invalid JSON body' }, { status: 400 })
    }
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, { status: 401 })
  }
}
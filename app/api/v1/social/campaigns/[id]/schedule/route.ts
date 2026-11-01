import { NextResponse } from 'next/server'
import { isPostizLivePublishingEnabled, isSocialExecutionGatesEnabled } from '@/config/social-marketing'
import { requireSocialApiActor, SocialApiError } from '@/lib/platform/social/route-auth'
type Params = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params) {
  try {
    const { id: campaignId } = await params
    await requireSocialApiActor()

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
            'POSTIZ_LIVE_PUBLISHING_ENABLED is false and SOCIAL_EXECUTION_GATES_ENABLED is false; use domain prep tests or enable execution gates.',
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

    return NextResponse.json(
      {
        code: 'DISPATCH_BLOCKED',
        message:
          'POSTIZ_LIVE_PUBLISHING_ENABLED is false. Only request shape was checked; campaign approval and scheduling authorization were not verified on this route. No scheduling intent was persisted and no scheduling or publishing occurred.',
        campaignId,
        intentPersisted: false,
        schedulingOccurred: false,
        publishingOccurred: false,
        livePublishingEnabled: false,
        executionGatesEnabled: true,
      },
      { status: 503 },
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

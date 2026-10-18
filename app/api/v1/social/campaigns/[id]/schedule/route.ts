import { NextResponse } from 'next/server'
import { isPostizLivePublishingEnabled } from '@/config/social-marketing'
import { requireSocialApiActor, SocialApiError } from '@/lib/platform/social/route-auth'

type Params = { params: Promise<{ id: string }> }

export async function POST(_request: Request, { params }: Params) {
  try {
    await params
    await requireSocialApiActor()
    if (!isPostizLivePublishingEnabled()) {
      return NextResponse.json(
        {
          code: 'NOT_CONFIGURED',
          message: 'POSTIZ_LIVE_PUBLISHING_ENABLED is false; scheduling intents are domain-tested only.',
        },
        { status: 503 },
      )
    }
    return NextResponse.json({ code: 'PENDING_PILOT', message: 'Live scheduling route pending owner activation' }, { status: 501 })
  } catch (error) {
    if (error instanceof SocialApiError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.status })
    }
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, { status: 401 })
  }
}

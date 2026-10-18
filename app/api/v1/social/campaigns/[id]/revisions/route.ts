import { NextResponse } from 'next/server'
import { createSocialCampaignRevisionPersist } from '@/lib/platform/social/revision-create-service'
import { requireSocialApiActor, SocialApiError } from '@/lib/platform/social/route-auth'
import { socialResultHttpStatus } from '@/lib/platform/social/social-api-map'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params) {
  try {
    const { id: campaignId } = await params
    const actor = await requireSocialApiActor()
    const body = (await request.json()) as {
      captionEn?: string
      captionEs?: string
      targetChannelIds?: string[]
      scheduledAt?: string
      mediaRefs?: string[]
      platformPayloads?: Record<string, unknown>
    }
    if (!body.captionEn || !Array.isArray(body.targetChannelIds)) {
      return NextResponse.json({ code: 'INVALID_BODY', message: 'captionEn and targetChannelIds required' }, { status: 400 })
    }
    const revision = await createSocialCampaignRevisionPersist({
      campaignId,
      customerAccountId: actor.customerAccountId,
      managedSiteId: actor.managedSiteId,
      captionEn: body.captionEn,
      captionEs: body.captionEs,
      targetChannelIds: body.targetChannelIds,
      scheduledAt: body.scheduledAt,
      mediaRefs: body.mediaRefs,
      platformPayloads: body.platformPayloads,
    })
    if (!revision.ok) {
      return NextResponse.json(
        { code: revision.code, message: revision.message },
        { status: socialResultHttpStatus(revision.code) },
      )
    }
    return NextResponse.json({ revision }, { status: 201 })
  } catch (error) {
    if (error instanceof SocialApiError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.status })
    }
    console.error('social campaign revision POST failed', error)
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Unable to create revision' }, { status: 500 })
  }
}

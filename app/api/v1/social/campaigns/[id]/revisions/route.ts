import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { stableSocialContentHash } from '@/lib/platform/social/hash'
import { requireSocialApiActor, SocialApiError } from '@/lib/platform/social/route-auth'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params) {
  try {
    const { id: campaignId } = await params
    const actor = await requireSocialApiActor()
    const campaign = await prisma.socialCampaign.findFirst({
      where: { id: campaignId, customerAccountId: actor.customerAccountId },
    })
    if (!campaign) {
      return NextResponse.json({ code: 'NOT_FOUND', message: 'Campaign not found' }, { status: 404 })
    }
    const body = (await request.json()) as {
      captionEn?: string
      captionEs?: string
      targetChannelIds?: string[]
      scheduledAt?: string
      mediaRefs?: string[]
    }
    if (!body.captionEn || !Array.isArray(body.targetChannelIds)) {
      return NextResponse.json({ code: 'INVALID_BODY', message: 'captionEn and targetChannelIds required' }, { status: 400 })
    }
    const count = await prisma.socialCampaignRevision.count({ where: { campaignId } })
    const contentHash = stableSocialContentHash({
      captionEn: body.captionEn,
      captionEs: body.captionEs,
      targetChannelIds: body.targetChannelIds,
      scheduledAt: body.scheduledAt,
    })
    const revision = await prisma.socialCampaignRevision.create({
      data: {
        campaignId,
        revisionNumber: count + 1,
        contentHash,
        captionEn: body.captionEn,
        captionEs: body.captionEs,
        mediaRefs: body.mediaRefs ?? [],
        platformPayloads: {},
        targetChannelIds: body.targetChannelIds,
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : undefined,
      },
    })
    await prisma.socialCampaign.update({
      where: { id: campaignId },
      data: { activeRevisionId: revision.id, status: 'DRAFT', approvedRevisionId: null },
    })
    return NextResponse.json({ revision }, { status: 201 })
  } catch (error) {
    if (error instanceof SocialApiError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.status })
    }
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, { status: 401 })
  }
}

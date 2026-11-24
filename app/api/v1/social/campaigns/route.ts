import { NextResponse } from 'next/server'
import { socialRouteError } from '@/lib/platform/social/http'
import { prisma } from '@/lib/db'
import { createSocialCampaignWithQuota } from '@/lib/platform/social/campaign-create-service'
import { requireSocialApiActor, SocialApiError } from '@/lib/platform/social/route-auth'
import { socialResultHttpStatus } from '@/lib/platform/social/social-api-map'

export async function GET() {
  try {
    const actor = await requireSocialApiActor()
    const campaigns = await prisma.socialCampaign.findMany({
      where: { customerAccountId: actor.customerAccountId },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    })
    return NextResponse.json({ campaigns })
  } catch (error) {
    return socialRouteError(error)
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireSocialApiActor()
    const body = (await request.json()) as {
      goal?: string
      locale?: 'en' | 'es'
      targetPlatforms?: string[]
      targetAudience?: string
      brandProfile?: string
      idempotencyKey?: string
    }
    if (!body.goal || !body.locale || !Array.isArray(body.targetPlatforms) || body.targetPlatforms.length === 0) {
      return NextResponse.json({ code: 'INVALID_BODY', message: 'goal, locale and targetPlatforms required' }, { status: 400 })
    }
    const created = await createSocialCampaignWithQuota({
      customerAccountId: actor.customerAccountId,
      managedSiteId: actor.managedSiteId,
      createdByUserId: actor.userId,
      goal: body.goal,
      locale: body.locale,
      targetPlatforms: body.targetPlatforms,
      targetAudience: body.targetAudience,
      brandProfile: body.brandProfile,
      idempotencyKey: body.idempotencyKey,
    })
    if (!created.ok) {
      return NextResponse.json({ code: created.code, message: created.message }, { status: socialResultHttpStatus(created.code) })
    }
    const campaign = await prisma.socialCampaign.findUnique({ where: { id: created.value.id } })
    return NextResponse.json({ campaign }, { status: 201 })
  } catch (error) {
    return socialRouteError(error)
  }
}

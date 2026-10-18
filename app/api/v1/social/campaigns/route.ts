import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSocialApiActor, SocialApiError } from '@/lib/platform/social/route-auth'

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
    if (error instanceof SocialApiError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.status })
    }
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, { status: 401 })
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
    }
    if (!body.goal || !body.locale || !Array.isArray(body.targetPlatforms) || body.targetPlatforms.length === 0) {
      return NextResponse.json({ code: 'INVALID_BODY', message: 'goal, locale and targetPlatforms required' }, { status: 400 })
    }
    const campaign = await prisma.socialCampaign.create({
      data: {
        customerAccountId: actor.customerAccountId,
        managedSiteId: actor.managedSiteId,
        createdByUserId: actor.userId,
        goal: body.goal,
        locale: body.locale,
        targetPlatforms: body.targetPlatforms,
        targetAudience: body.targetAudience,
        brandProfile: body.brandProfile,
        status: 'DRAFT',
      },
    })
    return NextResponse.json({ campaign }, { status: 201 })
  } catch (error) {
    if (error instanceof SocialApiError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.status })
    }
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, { status: 401 })
  }
}

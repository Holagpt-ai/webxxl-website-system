import { NextResponse } from 'next/server'
import { socialRouteError } from '@/lib/platform/social/http'
import { prisma } from '@/lib/db'
import { requireSocialApiActor, SocialApiError } from '@/lib/platform/social/route-auth'

export async function GET() {
  try {
    const actor = await requireSocialApiActor()
    const publications = await prisma.socialPublication.findMany({
      where: { customerAccountId: actor.customerAccountId },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    })
    return NextResponse.json({ publications })
  } catch (error) {
    return socialRouteError(error)
  }
}

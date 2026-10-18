import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSocialApiActor, SocialApiError } from '@/lib/platform/social/route-auth'

export async function GET() {
  try {
    const actor = await requireSocialApiActor()
    const connections = await prisma.businessSocialConnection.findMany({
      where: { customerAccountId: actor.customerAccountId },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    })
    return NextResponse.json({ connections })
  } catch (error) {
    if (error instanceof SocialApiError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.status })
    }
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, { status: 401 })
  }
}

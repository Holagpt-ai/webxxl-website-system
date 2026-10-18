import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSocialApiActor, SocialApiError } from '@/lib/platform/social/route-auth'

export async function GET(request: Request) {
  try {
    const actor = await requireSocialApiActor()
    const { searchParams } = new URL(request.url)
    const from = new Date(searchParams.get('from') ?? new Date().toISOString())
    const to = new Date(searchParams.get('to') ?? new Date(Date.now() + 30 * 86400000).toISOString())
    const campaigns = await prisma.socialCampaign.findMany({
      where: {
        customerAccountId: actor.customerAccountId,
        OR: [{ startDate: { gte: from, lte: to } }, { endDate: { gte: from, lte: to } }],
      },
      take: 200,
    })
    return NextResponse.json({ from: from.toISOString(), to: to.toISOString(), campaigns })
  } catch (error) {
    if (error instanceof SocialApiError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.status })
    }
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, { status: 401 })
  }
}

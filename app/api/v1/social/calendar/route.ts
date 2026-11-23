import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSocialApiActor, SocialApiError } from '@/lib/platform/social/route-auth'

function parseCalendarDate(value: string | null, fallback: Date): Date | null {
  if (!value) return fallback
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

export async function GET(request: Request) {
  try {
    const actor = await requireSocialApiActor()
    const { searchParams } = new URL(request.url)
    const defaultFrom = new Date()
    const defaultTo = new Date(Date.now() + 30 * 86400000)
    const from = parseCalendarDate(searchParams.get('from'), defaultFrom)
    const to = parseCalendarDate(searchParams.get('to'), defaultTo)
    if (!from || !to) {
      return NextResponse.json({ code: 'INVALID_BODY', message: 'from and to must be valid ISO dates' }, { status: 400 })
    }
    if (from > to) {
      return NextResponse.json({ code: 'INVALID_BODY', message: 'from must be before to' }, { status: 400 })
    }
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
    console.error('social calendar GET failed', error)
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, { status: 401 })
  }
}
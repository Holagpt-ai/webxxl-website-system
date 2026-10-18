import { NextResponse } from 'next/server'
import { MKT_LIST_DEFAULT_TAKE, MKT_LIST_MAX_TAKE } from '@/config/mkt-backend'
import { prisma } from '@/lib/db'
import { mktRouteError } from '@/lib/platform/marketing/api-response'
import { requireMktApiActor } from '@/lib/platform/marketing/route-auth'

export async function GET(request: Request) {
  try {
    const actor = await requireMktApiActor('marketing.followup.read')
    const url = new URL(request.url)
    const take = Math.min(Math.max(Number(url.searchParams.get('take') ?? MKT_LIST_DEFAULT_TAKE), 1), MKT_LIST_MAX_TAKE)
    const evaluations = await prisma.marketingLeadFollowUpEvaluation.findMany({
      where: { customerAccountId: actor.customerAccountId },
      orderBy: { lastEvaluatedAt: 'desc' },
      take,
    })
    return NextResponse.json({ evaluations })
  } catch (error) {
    return mktRouteError(error)
  }
}

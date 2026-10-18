import { NextResponse } from 'next/server'
import { MKT_LIST_DEFAULT_TAKE, MKT_LIST_MAX_TAKE } from '@/config/mkt-backend'
import { prisma } from '@/lib/db'
import { mktRouteError, mktServiceResponse } from '@/lib/platform/marketing/api-response'
import { createMarketingRequestRecord } from '@/lib/platform/marketing/request-service'
import { requireMktApiActor } from '@/lib/platform/marketing/route-auth'
import type { MarketingRequestCategory } from '@/lib/platform/marketing/types'

export async function GET(request: Request) {
  try {
    const actor = await requireMktApiActor('marketing.read')
    const url = new URL(request.url)
    const take = Math.min(Math.max(Number(url.searchParams.get('take') ?? MKT_LIST_DEFAULT_TAKE), 1), MKT_LIST_MAX_TAKE)
    const requests = await prisma.marketingRequest.findMany({
      where: { customerAccountId: actor.customerAccountId },
      orderBy: { createdAt: 'desc' },
      take,
    })
    return NextResponse.json({ requests })
  } catch (error) {
    return mktRouteError(error)
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireMktApiActor('marketing.request.create')
    const body = (await request.json()) as {
      managedSiteId?: string
      category?: MarketingRequestCategory
      goal?: string
      brief?: string
      locale?: 'en' | 'es'
      audience?: string
      sourceRefs?: string[]
      idempotencyKey?: string
      seoOpportunityId?: string
    }
    if (!body.category || !body.goal || !body.brief || !body.idempotencyKey) {
      return NextResponse.json({ code: 'VALIDATION', message: 'category, goal, brief, idempotencyKey required' }, { status: 400 })
    }
    const created = await createMarketingRequestRecord({
      customerAccountId: actor.customerAccountId,
      userId: actor.userId,
      managedSiteId: body.managedSiteId,
      category: body.category,
      goal: body.goal,
      brief: body.brief,
      locale: body.locale ?? 'en',
      audience: body.audience,
      sourceRefs: body.sourceRefs,
      idempotencyKey: body.idempotencyKey,
      seoOpportunityId: body.seoOpportunityId,
    })
    return mktServiceResponse(created, 201)
  } catch (error) {
    return mktRouteError(error)
  }
}

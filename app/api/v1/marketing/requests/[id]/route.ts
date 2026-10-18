import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { mktRouteError } from '@/lib/platform/marketing/api-response'
import { requireMktApiActor } from '@/lib/platform/marketing/route-auth'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  try {
    const actor = await requireMktApiActor('marketing.read')
    const { id } = await params
    const record = await prisma.marketingRequest.findFirst({
      where: { id, customerAccountId: actor.customerAccountId },
    })
    if (!record) return NextResponse.json({ code: 'NOT_FOUND', message: 'Request not found' }, { status: 404 })
    return NextResponse.json({ request: record })
  } catch (error) {
    return mktRouteError(error)
  }
}

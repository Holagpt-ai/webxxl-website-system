import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { mktRouteError } from '@/lib/platform/marketing/api-response'
import { requireMktApiActor } from '@/lib/platform/marketing/route-auth'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  try {
    const actor = await requireMktApiActor('marketing.read')
    const { id } = await params
    const request = await prisma.marketingRequest.findFirst({
      where: { id, customerAccountId: actor.customerAccountId },
    })
    if (!request) return NextResponse.json({ code: 'NOT_FOUND', message: 'Request not found' }, { status: 404 })
    const artifacts = await prisma.marketingArtifact.findMany({
      where: { customerAccountId: actor.customerAccountId, marketingRequestId: id },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ artifacts })
  } catch (error) {
    return mktRouteError(error)
  }
}

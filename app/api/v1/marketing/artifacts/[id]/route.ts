import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { mktRouteError } from '@/lib/platform/marketing/api-response'
import { requireMktApiActor } from '@/lib/platform/marketing/route-auth'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  try {
    const actor = await requireMktApiActor('marketing.read')
    const { id } = await params
    const artifact = await prisma.marketingArtifact.findFirst({
      where: { id, customerAccountId: actor.customerAccountId },
    })
    if (!artifact) return NextResponse.json({ code: 'NOT_FOUND', message: 'Artifact not found' }, { status: 404 })
    const revisions = await prisma.marketingArtifactRevision.findMany({
      where: { marketingArtifactId: id },
      orderBy: { revisionNumber: 'asc' },
    })
    return NextResponse.json({ artifact, revisions })
  } catch (error) {
    return mktRouteError(error)
  }
}

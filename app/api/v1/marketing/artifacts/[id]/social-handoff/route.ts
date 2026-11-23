import { NextResponse } from 'next/server'
import { mktRouteError, mktServiceResponse } from '@/lib/platform/marketing/api-response'
import { requireMktApiActor } from '@/lib/platform/marketing/route-auth'
import { prepareApprovedCreativeSocialHandoff } from '@/lib/platform/marketing/social-handoff-service'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params) {
  try {
    const actor = await requireMktApiActor('marketing.read')
    const { id: marketingArtifactId } = await params
    const body = (await request.json()) as {
      revisionHash?: string
      allowedChannel?: string | null
      managedSiteId?: string | null
    }
    if (!body.revisionHash) {
      return NextResponse.json({ code: 'VALIDATION', message: 'revisionHash required' }, { status: 400 })
    }
    const prepared = await prepareApprovedCreativeSocialHandoff({
      customerAccountId: actor.customerAccountId,
      marketingArtifactId,
      revisionHash: body.revisionHash,
      managedSiteId: body.managedSiteId ?? undefined,
      allowedChannel: body.allowedChannel ?? undefined,
    })
    const successStatus = prepared.ok && prepared.value.handoffState === 'PREPARED' ? 201 : 200
    return mktServiceResponse(prepared, successStatus)
  } catch (error) {
    return mktRouteError(error)
  }
}
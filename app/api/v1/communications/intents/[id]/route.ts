import { NextResponse } from 'next/server'
import { commsRouteError } from '@/lib/platform/comms/http'
import { prisma } from '@/lib/db'
import { requireCommsApiActor, CommsApiError } from '@/lib/platform/comms/route-auth'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  try {
    const actor = await requireCommsApiActor('comms.read')
    const { id } = await params
    const intent = await prisma.communicationIntent.findFirst({
      where: { id, customerAccountId: actor.customerAccountId },
      include: { recipients: true, dispatchAttempts: true },
    })
    if (!intent) {
      return NextResponse.json({ code: 'NOT_FOUND', message: 'Intent not found' }, { status: 404 })
    }
    return NextResponse.json({
      intent: {
        id: intent.id,
        status: intent.status,
        policyDecision: intent.policyDecision,
        channel: intent.channel,
        purpose: intent.purpose,
        contentHash: intent.contentHash,
        recipients: intent.recipients,
        dispatchAttempts: intent.dispatchAttempts.map((a) => ({
          id: a.id,
          status: a.status,
          providerMessageRef: a.providerMessageRef,
        })),
      },
    })
  } catch (error) {
    return commsRouteError(error)
  }
}

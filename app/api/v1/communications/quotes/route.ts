import { NextResponse } from 'next/server'
import { prepareCommunicationQuote } from '@/lib/platform/comms/quote-service'
import { commsResultHttpStatus } from '@/lib/platform/comms/comms-api-map'
import { requireCommsApiActor, CommsApiError } from '@/lib/platform/comms/route-auth'
import type { CrmConsentChannel, CrmConsentPurpose } from '@prisma/client'

export async function POST(request: Request) {
  try {
    const actor = await requireCommsApiActor('comms.quote')
    const body = (await request.json()) as {
      channel?: CrmConsentChannel
      purpose?: CrmConsentPurpose
      recipientContactIds?: string[]
      synthetic200?: boolean
    }
    if (!body.channel || !body.purpose) {
      return NextResponse.json({ code: 'VALIDATION', message: 'channel and purpose required' }, { status: 400 })
    }
    const result = await prepareCommunicationQuote({
      customerAccountId: actor.customerAccountId,
      actorUserId: actor.userId,
      channel: body.channel,
      purpose: body.purpose,
      recipientContactIds: body.recipientContactIds,
      synthetic200: body.synthetic200,
      allowSyntheticEvaluation: actor.isStaff,
    })
    if (!result.ok) {
      return NextResponse.json({ code: result.code, message: result.message }, { status: commsResultHttpStatus(result.code) })
    }
    return NextResponse.json({ quote: result.value })
  } catch (error) {
    if (error instanceof CommsApiError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.status })
    }
    console.error('communications quotes POST failed', error)
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Unable to prepare quote' }, { status: 500 })
  }
}

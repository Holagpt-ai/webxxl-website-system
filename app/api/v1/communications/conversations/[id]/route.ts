import { NextResponse } from 'next/server'
import { getAccountConversation } from '@/lib/platform/comms/conversation-service'
import { commsResultHttpStatus } from '@/lib/platform/comms/comms-api-map'
import { requireCommsApiActor, CommsApiError } from '@/lib/platform/comms/route-auth'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  try {
    const actor = await requireCommsApiActor('comms.read')
    const { id } = await params
    const result = await getAccountConversation({
      customerAccountId: actor.customerAccountId,
      conversationMappingId: id,
    })
    if (!result.ok) {
      return NextResponse.json({ code: result.code, message: result.message }, { status: commsResultHttpStatus(result.code) })
    }
    return NextResponse.json({ conversation: result.value })
  } catch (error) {
    if (error instanceof CommsApiError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.status })
    }
    console.error('communications conversation GET failed', error)
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Unable to load conversation' }, { status: 500 })
  }
}

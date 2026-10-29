import { NextResponse } from 'next/server'
import { listAccountInboxes } from '@/lib/platform/comms/inbox-service'
import { commsResultHttpStatus } from '@/lib/platform/comms/comms-api-map'
import { requireCommsApiActor, CommsApiError } from '@/lib/platform/comms/route-auth'

export async function GET() {
  try {
    const actor = await requireCommsApiActor('comms.read')
    const result = await listAccountInboxes({ customerAccountId: actor.customerAccountId })
    if (!result.ok) {
      return NextResponse.json({ code: result.code, message: result.message }, { status: commsResultHttpStatus(result.code) })
    }
    return NextResponse.json({ inboxes: result.value.inboxes })
  } catch (error) {
    if (error instanceof CommsApiError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.status })
    }
    console.error('communications inboxes GET failed', error)
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Unable to load inboxes' }, { status: 500 })
  }
}

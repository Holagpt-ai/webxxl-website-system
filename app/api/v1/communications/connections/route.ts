import { NextResponse } from 'next/server'
import { listCommsConnections } from '@/lib/platform/comms/connections-service'
import { commsResultHttpStatus } from '@/lib/platform/comms/comms-api-map'
import { requireCommsApiActor, CommsApiError } from '@/lib/platform/comms/route-auth'

export async function GET() {
  try {
    const actor = await requireCommsApiActor('comms.read')
    const result = await listCommsConnections({
      customerAccountId: actor.customerAccountId,
      actorUserId: actor.userId,
    })
    if (!result.ok) {
      return NextResponse.json({ code: result.code, message: result.message }, { status: commsResultHttpStatus(result.code) })
    }
    return NextResponse.json(result.value)
  } catch (error) {
    if (error instanceof CommsApiError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.status })
    }
    console.error('communications connections GET failed', error)
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Unable to load connections' }, { status: 500 })
  }
}

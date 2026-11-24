import { NextResponse } from 'next/server'
import { commsRouteError } from '@/lib/platform/comms/http'
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
    return commsRouteError(error)
  }
}

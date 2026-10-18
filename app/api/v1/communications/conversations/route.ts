import { NextResponse } from 'next/server'
import { COMMS_LIST_MAX_TAKE } from '@/config/comms-backend'
import { listAccountConversations } from '@/lib/platform/comms/conversation-service'
import { commsResultHttpStatus } from '@/lib/platform/comms/comms-api-map'
import { requireCommsApiActor, CommsApiError } from '@/lib/platform/comms/route-auth'
import type { CommsConversationFilter } from '@/lib/platform/comms/types'

export async function GET(request: Request) {
  try {
    const actor = await requireCommsApiActor('comms.read')
    const url = new URL(request.url)
    const filter = url.searchParams.get('filter') as CommsConversationFilter | null
    const take = Math.min(Math.max(Number(url.searchParams.get('take') ?? '50'), 1), COMMS_LIST_MAX_TAKE)
    const result = await listAccountConversations({
      customerAccountId: actor.customerAccountId,
      filter: filter ?? undefined,
      assignedUserRef: filter === 'assigned_to_me' ? actor.userId : undefined,
      take,
    })
    if (!result.ok) {
      return NextResponse.json({ code: result.code, message: result.message }, { status: commsResultHttpStatus(result.code) })
    }
    return NextResponse.json({ conversations: result.value })
  } catch (error) {
    if (error instanceof CommsApiError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.status })
    }
    console.error('communications conversations GET failed', error)
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Unable to load conversations' }, { status: 500 })
  }
}

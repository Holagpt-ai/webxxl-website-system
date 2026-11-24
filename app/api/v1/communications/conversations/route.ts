import { NextResponse } from 'next/server'
import { commsRouteError } from '@/lib/platform/comms/http'
import { listAccountConversations } from '@/lib/platform/comms/conversation-service'
import { commsResultHttpStatus } from '@/lib/platform/comms/comms-api-map'
import { requireCommsApiActor, CommsApiError } from '@/lib/platform/comms/route-auth'

const MAX_CHANNEL_LEN = 64

function parseTakeQuery(raw: string | null): number | undefined | 'invalid' {
  if (raw === null || raw === '') return undefined
  const value = Number(raw)
  if (!Number.isFinite(value)) return 'invalid'
  return value
}

export async function GET(request: Request) {
  try {
    const actor = await requireCommsApiActor('comms.read')
    const url = new URL(request.url)
    const filter = url.searchParams.get('filter') ?? undefined
    const inboxId = url.searchParams.get('inboxId') ?? url.searchParams.get('inbox') ?? undefined
    const channelRaw = url.searchParams.get('channel') ?? undefined
    const cursor = url.searchParams.get('cursor') ?? undefined
    const takeParsed = parseTakeQuery(url.searchParams.get('take'))

    if (takeParsed === 'invalid') {
      return NextResponse.json({ code: 'VALIDATION', message: 'Invalid take parameter' }, { status: 400 })
    }

    if (channelRaw && channelRaw.length > MAX_CHANNEL_LEN) {
      return NextResponse.json({ code: 'VALIDATION', message: 'Invalid channel filter' }, { status: 400 })
    }

    const result = await listAccountConversations({
      customerAccountId: actor.customerAccountId,
      filter,
      assignedUserRef: filter === 'assigned_to_me' ? actor.userId : undefined,
      inboxId,
      channel: channelRaw,
      take: takeParsed,
      cursor,
    })
    if (!result.ok) {
      return NextResponse.json({ code: result.code, message: result.message }, { status: commsResultHttpStatus(result.code) })
    }
    return NextResponse.json({
      conversations: result.value.conversations,
      ...(result.value.nextCursor ? { nextCursor: result.value.nextCursor } : {}),
    })
  } catch (error) {
    return commsRouteError(error)
  }
}

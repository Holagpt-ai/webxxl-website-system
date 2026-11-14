import { NextResponse } from 'next/server'
import { commsResultHttpStatus } from '@/lib/platform/comms/comms-api-map'
import {
  getConversationReplyContext,
  prepareConversationReply,
} from '@/lib/platform/comms/conversation-reply-service'
import { requireCommsApiActor, CommsApiError } from '@/lib/platform/comms/route-auth'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  try {
    const actor = await requireCommsApiActor('comms.read')
    const { id } = await params
    const result = await getConversationReplyContext({
      customerAccountId: actor.customerAccountId,
      actorUserId: actor.userId,
      conversationMappingId: id,
    })
    if (!result.ok) {
      return NextResponse.json({ code: result.code, message: result.message }, { status: commsResultHttpStatus(result.code) })
    }
    return NextResponse.json({ context: result.value })
  } catch (error) {
    if (error instanceof CommsApiError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.status })
    }
    console.error('communications reply-preparation GET failed', error)
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Unable to load reply preparation context' }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const actor = await requireCommsApiActor('comms.intent.prepare')
    const { id } = await params
    const body = (await request.json()) as {
      idempotencyKey?: string
      contentVersion?: string
      recipientAddress?: string
    }
    if (!body.idempotencyKey?.trim()) {
      return NextResponse.json({ code: 'VALIDATION', message: 'idempotencyKey required' }, { status: 400 })
    }
    const result = await prepareConversationReply({
      customerAccountId: actor.customerAccountId,
      actorUserId: actor.userId,
      conversationMappingId: id,
      idempotencyKey: body.idempotencyKey.trim(),
      contentVersion: body.contentVersion,
      recipientAddressOverride: body.recipientAddress,
    })
    if (!result.ok) {
      return NextResponse.json({ code: result.code, message: result.message }, { status: commsResultHttpStatus(result.code) })
    }
    return NextResponse.json(result.value)
  } catch (error) {
    if (error instanceof CommsApiError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.status })
    }
    console.error('communications reply-preparation POST failed', error)
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Unable to prepare reply intent' }, { status: 500 })
  }
}
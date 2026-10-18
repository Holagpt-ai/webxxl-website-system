import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { commsResultHttpStatus } from '@/lib/platform/comms/comms-api-map'
import { requireCommsApiActor, CommsApiError } from '@/lib/platform/comms/route-auth'

export async function GET() {
  try {
    const actor = await requireCommsApiActor('comms.read')
    const inboxes = await prisma.chatwootInboxMapping.findMany({
      where: { customerAccountId: actor.customerAccountId, verificationState: 'VERIFIED' },
      orderBy: { updatedAt: 'desc' },
    })
    return NextResponse.json({
      inboxes: inboxes.map((row) => ({
        id: row.id,
        externalInboxId: row.externalInboxId,
        channelType: row.channelType,
      })),
    })
  } catch (error) {
    if (error instanceof CommsApiError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.status })
    }
    console.error('communications inboxes GET failed', error)
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Unable to load inboxes' }, { status: 500 })
  }
}

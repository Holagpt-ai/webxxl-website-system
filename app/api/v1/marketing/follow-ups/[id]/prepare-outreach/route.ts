import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { mktRouteError, mktServiceResponse } from '@/lib/platform/marketing/api-response'
import { prepareMarketingOutreachDraft } from '@/lib/platform/marketing/comms-draft-handoff-service'
import { requireMktApiActor } from '@/lib/platform/marketing/route-auth'
import type { CrmConsentChannel } from '@prisma/client'

type Params = { params: Promise<{ id: string }> }

const CHANNELS: CrmConsentChannel[] = ['EMAIL', 'SMS', 'WHATSAPP']

async function resolvePrimaryRecipient(input: {
  customerAccountId: string
  contactId: string
  channel: CrmConsentChannel
}): Promise<string | null> {
  const identityType = input.channel === 'EMAIL' ? 'EMAIL' : input.channel === 'SMS' ? 'PHONE' : 'WHATSAPP'
  const identity = await prisma.crmContactChannelIdentity.findFirst({
    where: {
      customerAccountId: input.customerAccountId,
      contactId: input.contactId,
      identityType,
      isPrimary: true,
    },
    select: { normalizedValue: true, displayValue: true },
    orderBy: { updatedAt: 'desc' },
  })
  return identity?.normalizedValue ?? identity?.displayValue ?? null
}

export async function POST(request: Request, { params }: Params) {
  try {
    const actor = await requireMktApiActor('marketing.followup.manage')
    const { id } = await params
    const body = (await request.json()) as {
      channel?: string
      contentVersion?: string
      idempotencyKey?: string
      recipientAddress?: string
    }
    const channel = body.channel as CrmConsentChannel | undefined
    if (!channel || !CHANNELS.includes(channel)) {
      return NextResponse.json({ code: 'VALIDATION', message: 'channel must be EMAIL, SMS, or WHATSAPP' }, { status: 400 })
    }
    if (!body.contentVersion?.trim() || !body.idempotencyKey?.trim()) {
      return NextResponse.json(
        { code: 'VALIDATION', message: 'contentVersion and idempotencyKey required' },
        { status: 400 },
      )
    }
    const evaluation = await prisma.marketingLeadFollowUpEvaluation.findFirst({
      where: { id, customerAccountId: actor.customerAccountId },
    })
    if (!evaluation) {
      return NextResponse.json({ code: 'NOT_FOUND', message: 'Evaluation not found' }, { status: 404 })
    }
    const recipientAddress =
      body.recipientAddress?.trim() ||
      (await resolvePrimaryRecipient({
        customerAccountId: actor.customerAccountId,
        contactId: evaluation.crmContactId,
        channel,
      }))
    if (!recipientAddress) {
      return NextResponse.json({ code: 'VALIDATION', message: 'recipientAddress unavailable for channel' }, { status: 400 })
    }
    const prepared = await prepareMarketingOutreachDraft({
      customerAccountId: actor.customerAccountId,
      actorUserId: actor.userId,
      channel,
      purpose: 'MARKETING',
      crmContactId: evaluation.crmContactId,
      recipientAddress,
      contentVersion: body.contentVersion.trim(),
      idempotencyKey: body.idempotencyKey.trim(),
    })
    const status = prepared.ok ? 201 : 200
    return mktServiceResponse(prepared, status)
  } catch (error) {
    return mktRouteError(error)
  }
}
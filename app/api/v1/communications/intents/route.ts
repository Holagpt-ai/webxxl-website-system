import { NextResponse } from 'next/server'
import { commsRouteError } from '@/lib/platform/comms/http'
import { prepareCommunicationIntent } from '@/lib/platform/comms/gateway-service'
import { commsResultHttpStatus } from '@/lib/platform/comms/comms-api-map'
import { requireCommsApiActor, CommsApiError } from '@/lib/platform/comms/route-auth'
import type { CrmConsentChannel, CrmConsentPurpose, CommsDataClassification } from '@prisma/client'

export async function POST(request: Request) {
  try {
    const actor = await requireCommsApiActor('comms.intent.prepare')
    const body = (await request.json()) as {
      channel?: CrmConsentChannel
      purpose?: CrmConsentPurpose
      recipientAddress?: string
      crmContactId?: string
      senderIdentityId?: string
      contentVersion?: string
      policyVersion?: string
      idempotencyKey?: string
      dataClassification?: CommsDataClassification
      aiActor?: boolean
      quoteId?: string
      billingGroupId?: string
      managedSiteId?: string
      /** Server may honor only when wallet/comms integration + reservation flags allow; never live send. */
      reserveWallet?: boolean
      // Intentionally ignored if present — approval evidence is DB-only.
      humanApprovalGranted?: unknown
    }
    if (!body.channel || !body.purpose || !body.recipientAddress || !body.idempotencyKey) {
      return NextResponse.json({ code: 'VALIDATION', message: 'Missing required intent fields' }, { status: 400 })
    }
    const result = await prepareCommunicationIntent({
      customerAccountId: actor.customerAccountId,
      actorUserId: actor.userId,
      channel: body.channel,
      purpose: body.purpose,
      recipientAddress: body.recipientAddress,
      crmContactId: body.crmContactId,
      senderIdentityId: body.senderIdentityId,
      contentVersion: body.contentVersion ?? 'v0',
      policyVersion: body.policyVersion ?? 'comms-policy-v0',
      idempotencyKey: body.idempotencyKey,
      dataClassification: body.dataClassification,
      aiActor: body.aiActor,
      quoteId: body.quoteId,
      billingGroupId: body.billingGroupId,
      managedSiteId: body.managedSiteId,
      reserveWallet: body.reserveWallet === true,
    })
    if (!result.ok) {
      return NextResponse.json({ code: result.code, message: result.message }, { status: commsResultHttpStatus(result.code) })
    }
    return NextResponse.json({ intent: result.value })
  } catch (error) {
    return commsRouteError(error)
  }
}

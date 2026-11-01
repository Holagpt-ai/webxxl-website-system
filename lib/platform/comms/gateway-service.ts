import { isCommunicationsOutboundEnabled, isSmsSendEnabled } from '@/config/comms-backend'
import { commsProviderDispatchBlocked } from '@/lib/platform/comms/execution-gates'
import { prisma } from '@/lib/db'
import { evaluateChatwootDirectSendBypass, evaluateCommunicationPolicy } from '@/lib/platform/comms/policy-engine'
import { buildCommunicationContentHash } from '@/lib/platform/comms/intent-hash'
import { resolveEffectiveAiActor, resolveServerDataClassification } from '@/lib/platform/comms/intent-auth'
import type { CommsResult } from '@/lib/platform/comms/types'
import type { CrmConsentChannel, CrmConsentPurpose, CommsDataClassification } from '@prisma/client'

export async function prepareCommunicationIntent(input: {
  customerAccountId: string
  actorUserId: string
  channel: CrmConsentChannel
  purpose: CrmConsentPurpose
  senderIdentityId?: string
  recipientAddress: string
  crmContactId?: string
  contentVersion: string
  policyVersion: string
  idempotencyKey: string
  dataClassification?: CommsDataClassification
  aiActor?: boolean
}): Promise<CommsResult<{ intentId: string; status: string; policyDecision: string }>> {
  const contentHash = buildCommunicationContentHash({
    customerAccountId: input.customerAccountId,
    senderIdentityId: input.senderIdentityId ?? null,
    recipient: input.recipientAddress,
    channel: input.channel,
    purpose: input.purpose,
    contentVersion: input.contentVersion,
    policyVersion: input.policyVersion,
  })

  const existing = await prisma.communicationIntent.findUnique({ where: { idempotencyKey: input.idempotencyKey } })
  if (existing) {
    if (existing.customerAccountId !== input.customerAccountId) {
      return { ok: false, code: 'CONFLICT', message: 'Intent idempotency key bound to another account' }
    }
    if (existing.contentHash !== contentHash) {
      return { ok: false, code: 'CONFLICT', message: 'Intent idempotency key reused with different fingerprint' }
    }
    return {
      ok: true,
      value: { intentId: existing.id, status: existing.status, policyDecision: existing.policyDecision },
    }
  }

  let senderClassification: CommsDataClassification | null = null
  if (input.senderIdentityId) {
    const sender = await prisma.senderIdentity.findFirst({
      where: {
        id: input.senderIdentityId,
        customerAccountId: input.customerAccountId,
        revokedAt: null,
      },
    })
    if (!sender) return { ok: false, code: 'NOT_FOUND', message: 'Sender identity not found for account' }
    if (sender.channel !== input.channel) {
      return { ok: false, code: 'FORBIDDEN', message: 'Sender identity channel mismatch' }
    }
    senderClassification = sender.dataClassification
  }

  let suppressed = false
  let consentStatus: 'GRANTED' | 'REVOKED' | 'UNKNOWN' | 'NONE' = 'UNKNOWN'
  if (input.crmContactId) {
    const contact = await prisma.crmContact.findFirst({
      where: { id: input.crmContactId, customerAccountId: input.customerAccountId },
    })
    if (!contact) return { ok: false, code: 'NOT_FOUND', message: 'CRM contact not found for account' }
    const suppression = await prisma.contactSuppression.findFirst({
      where: {
        customerAccountId: input.customerAccountId,
        contactId: input.crmContactId,
        channel: input.channel,
        purpose: input.purpose,
        active: true,
      },
    })
    suppressed = Boolean(suppression)
    const consent = await prisma.contactConsent.findFirst({
      where: {
        customerAccountId: input.customerAccountId,
        contactId: input.crmContactId,
        channel: input.channel,
        purpose: input.purpose,
      },
      orderBy: { capturedAt: 'desc' },
    })
    consentStatus = consent?.status === 'GRANTED' ? 'GRANTED' : consent ? 'REVOKED' : 'UNKNOWN'
  }

  const dataClassification = resolveServerDataClassification({
    clientClassification: input.dataClassification,
    senderClassification,
  })
  const aiActorEffective = await resolveEffectiveAiActor({
    actorUserId: input.actorUserId,
    customerAccountId: input.customerAccountId,
    clientAiActor: input.aiActor,
  })

  const policyDecision = evaluateCommunicationPolicy({
    customerAccountId: input.customerAccountId,
    contactId: input.crmContactId,
    channel: input.channel,
    purpose: input.purpose,
    senderAccountId: input.customerAccountId,
    recipientAccountId: input.customerAccountId,
    consentStatus,
    suppressed,
    providerConnected: false,
    walletQuoteAvailable: false,
    dataClassification,
    approvedRegulatedWorkflow: false,
    aiActor: aiActorEffective,
  })

  let status: 'DRAFT' | 'BLOCKED' | 'PENDING_APPROVAL' = 'DRAFT'
  if (policyDecision === 'DENIED' || policyDecision === 'NOT_CONFIGURED' || policyDecision === 'COMPLIANCE_REVIEW_REQUIRED') {
    status = 'BLOCKED'
  } else if (policyDecision === 'REQUIRES_APPROVAL') {
    status = 'PENDING_APPROVAL'
  }

  const intent = await prisma.communicationIntent.create({
    data: {
      customerAccountId: input.customerAccountId,
      actorUserId: input.actorUserId,
      channel: input.channel,
      purpose: input.purpose,
      senderIdentityId: input.senderIdentityId,
      status,
      contentHash,
      policyDecision,
      dataClassification,
      approvalRequired: policyDecision === 'REQUIRES_APPROVAL',
      idempotencyKey: input.idempotencyKey,
      recipients: {
        create: {
          customerAccountId: input.customerAccountId,
          crmContactId: input.crmContactId,
          normalizedAddress: input.recipientAddress,
          eligibility: policyDecision,
        },
      },
    },
  })

  await prisma.communicationAuditEvent.create({
    data: {
      customerAccountId: input.customerAccountId,
      actorUserId: input.actorUserId,
      operation: 'intent.prepare',
      resourceRef: intent.id,
      detail: { policyDecision, channel: input.channel, aiActorEffective },
    },
  })

  return { ok: true, value: { intentId: intent.id, status: intent.status, policyDecision } }
}

/** All billable sends remain blocked in COMMS-06 (no wallet debit, no transport). */
export async function attemptGatewayDispatch(input: {
  intentId: string
  customerAccountId: string
  idempotencyKey: string
}): Promise<CommsResult<{ status: string }>> {
  const intent = await prisma.communicationIntent.findFirst({
    where: { id: input.intentId, customerAccountId: input.customerAccountId },
  })
  if (!intent) return { ok: false, code: 'NOT_FOUND', message: 'Intent not found' }
  const integrationBlock = commsProviderDispatchBlocked()
  if (integrationBlock) {
    await prisma.communicationDispatchAttempt.create({
      data: {
        intentId: intent.id,
        customerAccountId: input.customerAccountId,
        status: 'BLOCKED',
        idempotencyKey: input.idempotencyKey,
        detail: { reason: integrationBlock && !integrationBlock.ok ? integrationBlock.code : 'BLOCKED' },
      },
    })
    return { ok: true, value: { status: 'BLOCKED' } }
  }
  if (!isCommunicationsOutboundEnabled() || !isSmsSendEnabled()) {
    await prisma.communicationDispatchAttempt.create({
      data: {
        intentId: intent.id,
        customerAccountId: input.customerAccountId,
        status: 'BLOCKED',
        idempotencyKey: input.idempotencyKey,
        detail: { reason: 'OUTBOUND_DISABLED' },
      },
    })
    return { ok: true, value: { status: 'BLOCKED' } }
  }
  return { ok: false, code: 'NOT_CONFIGURED', message: 'Live dispatch not activated in COMMS-06' }
}

export function denyChatwootNativeBillableSend(): CommsResult<{ allowed: false; decision: string }> {
  const decision = evaluateChatwootDirectSendBypass()
  return { ok: true, value: { allowed: false, decision } }
}

export function denyAiSelfAuthorizedSend(): CommsResult<{ allowed: false }> {
  return { ok: true, value: { allowed: false } }
}

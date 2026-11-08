import type { PrismaClient } from '@prisma/client'
import type { CrmConsentChannel, CrmConsentPurpose, CommsDataClassification } from '@prisma/client'
import { isCommsBackendEnabled, isCommsIntegrationGatesEnabled } from '@/config/comms-backend'
import { prisma as defaultPrisma } from '@/lib/db'
import { authorizeOutboundCommunication } from '@/lib/platform/comms/outbound-authorization-gateway'
import { prepareCommsWalletReservation } from '@/lib/platform/comms/wallet-boundary'
import { evaluateChatwootDirectSendBypass } from '@/lib/platform/comms/policy-engine'
import type { CommsResult } from '@/lib/platform/comms/types'
import { loadOutboundAuthorizationInput } from '@/lib/platform/comms-execution/outbound-auth-loader'
import type { GuardedCommsPrepareResult } from '@/lib/platform/comms-execution/types'
import {
  PREPARATION_ONLY_DISPATCH_BLOCKED_CODE,
} from '@/lib/platform/comms-execution/constants'

export type GuardedCommsPrepareInput = {
  customerAccountId: string
  actorUserId: string
  channel: CrmConsentChannel
  purpose: CrmConsentPurpose
  recipientAddress: string
  crmContactId?: string
  senderIdentityId?: string
  managedSiteId?: string
  contentVersion: string
  policyVersion: string
  idempotencyKey: string
  dataClassification?: CommsDataClassification
  aiActor?: boolean
  humanApprovalGranted?: boolean
  quoteId?: string
  billingGroupId?: string
  /** When set with quoteId + billingGroupId, attempts wallet hold while outbound remains OFF. */
  reserveWallet?: boolean
  reservationIdempotencyKey?: string
  correlationId?: string
  approvedRegulatedWorkflow?: boolean
  attemptedCrossAccountConversation?: boolean
}

/**
 * End-to-end guarded preparation: CRM/consent/sender/wallet facts → outbound auth →
 * durable intent → optional quote bind → optional wallet reservation.
 * Never calls Twilio/Resend/Chatwoot transport. Dispatch remains blocked.
 */
export async function prepareGuardedCommunication(
  input: GuardedCommsPrepareInput,
  db: PrismaClient = defaultPrisma,
): Promise<CommsResult<GuardedCommsPrepareResult>> {
  if (!isCommsBackendEnabled()) {
    return { ok: false, code: 'COMMS_DISABLED', message: 'Communications backend is disabled' }
  }
  if (!isCommsIntegrationGatesEnabled()) {
    return { ok: false, code: 'NOT_CONFIGURED', message: 'COMMS_INTEGRATION_GATES_ENABLED is false' }
  }

  const loaded = await loadOutboundAuthorizationInput(
    {
      customerAccountId: input.customerAccountId,
      actorUserId: input.actorUserId,
      channel: input.channel,
      purpose: input.purpose,
      recipientAddress: input.recipientAddress,
      crmContactId: input.crmContactId,
      senderIdentityId: input.senderIdentityId,
      managedSiteId: input.managedSiteId,
      contentVersion: input.contentVersion,
      policyVersion: input.policyVersion,
      idempotencyKey: input.idempotencyKey,
      dataClassification: input.dataClassification,
      aiActor: input.aiActor,
      humanApprovalGranted: input.humanApprovalGranted,
      quoteId: input.quoteId,
      approvedRegulatedWorkflow: input.approvedRegulatedWorkflow,
      attemptedCrossAccountConversation: input.attemptedCrossAccountConversation,
    },
    db,
  )
  if (!loaded.ok) return loaded

  const auth = authorizeOutboundCommunication(loaded.value)
  if (!auth.ok) return auth

  // Chatwoot native billable send must never bypass WebXXL (always blocked in this path).
  if (!auth.value.chatwootNativeSendBlocked || evaluateChatwootDirectSendBypass() === 'ALLOW_PREPARATION') {
    return {
      ok: false,
      code: 'FORBIDDEN',
      message: 'Chatwoot native send bypass is not permitted through WebXXL preparation',
    }
  }

  const existing = await db.communicationIntent.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  })
  if (existing) {
    if (existing.customerAccountId !== input.customerAccountId) {
      return { ok: false, code: 'CONFLICT', message: 'Intent idempotency key bound to another account' }
    }
    if (existing.contentHash !== loaded.value.contentFingerprint) {
      return { ok: false, code: 'CONFLICT', message: 'Intent idempotency key reused with different fingerprint' }
    }
    return {
      ok: true,
      value: {
        intentId: existing.id,
        status: existing.status,
        policyDecision: existing.policyDecision,
        dispatchBlocked: true,
        dispatchBlockedCode: auth.value.dispatchBlockedCode || PREPARATION_ONLY_DISPATCH_BLOCKED_CODE,
        chatwootNativeSendBlocked: true,
        quoteId: existing.quoteId,
        reservationId: null,
        walletReservationAttempted: false,
      },
    }
  }

  let quoteId: string | null = input.quoteId ?? null
  if (quoteId) {
    const quote = await db.communicationQuote.findFirst({
      where: { id: quoteId, customerAccountId: input.customerAccountId },
    })
    if (!quote) return { ok: false, code: 'NOT_FOUND', message: 'Communication quote not found for account' }
    if (quote.channel !== input.channel || quote.purpose !== input.purpose) {
      return { ok: false, code: 'FORBIDDEN', message: 'Quote channel/purpose mismatch' }
    }
    if (quote.contentHash && quote.contentHash !== loaded.value.contentFingerprint) {
      return { ok: false, code: 'FORBIDDEN', message: 'Quote content hash does not match intent fingerprint' }
    }
    if (!quote.contentHash) {
      await db.communicationQuote.update({
        where: { id: quote.id },
        data: {
          contentHash: loaded.value.contentFingerprint,
          policyVersion: input.policyVersion,
          billingGroupId: input.billingGroupId ?? quote.billingGroupId,
          senderIdentityId: input.senderIdentityId ?? quote.senderIdentityId,
        },
      })
    } else if (input.billingGroupId && !quote.billingGroupId) {
      await db.communicationQuote.update({
        where: { id: quote.id },
        data: { billingGroupId: input.billingGroupId },
      })
    }
  }

  const policyDecision = auth.value.policyDecision
  let status: 'DRAFT' | 'BLOCKED' | 'PENDING_APPROVAL' = 'DRAFT'
  if (
    policyDecision === 'DENIED' ||
    policyDecision === 'NOT_CONFIGURED' ||
    policyDecision === 'COMPLIANCE_REVIEW_REQUIRED' ||
    policyDecision === 'INSUFFICIENT_CREDITS'
  ) {
    status = 'BLOCKED'
  } else if (policyDecision === 'REQUIRES_APPROVAL') {
    status = 'PENDING_APPROVAL'
  }

  const intent = await db.communicationIntent.create({
    data: {
      customerAccountId: input.customerAccountId,
      actorUserId: input.actorUserId,
      quoteId,
      channel: input.channel,
      purpose: input.purpose,
      senderIdentityId: input.senderIdentityId,
      status,
      contentHash: loaded.value.contentFingerprint,
      policyDecision,
      dataClassification: loaded.value.dataClassification,
      approvalRequired: policyDecision === 'REQUIRES_APPROVAL' || input.purpose === 'MARKETING',
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

  await db.communicationAuditEvent.create({
    data: {
      customerAccountId: input.customerAccountId,
      actorUserId: input.actorUserId,
      operation: 'intent.prepare.guarded',
      resourceRef: intent.id,
      detail: {
        policyDecision,
        channel: input.channel,
        dispatchBlocked: true,
        chatwootNativeSendBlocked: true,
        quoteId,
      },
    },
  })

  let reservationId: string | null = null
  let walletReservationAttempted = false
  if (input.reserveWallet && quoteId && input.billingGroupId) {
    walletReservationAttempted = true
    if (intent.approvalRequired && input.humanApprovalGranted === true) {
      await db.communicationApproval.create({
        data: {
          intentId: intent.id,
          customerAccountId: input.customerAccountId,
          approverUserId: input.actorUserId,
          decision: 'APPROVED',
          reason: 'immutable-server-approval-evidence',
        },
      })
    }
    const reserved = await prepareCommsWalletReservation(db, {
      billingGroupId: input.billingGroupId,
      customerAccountId: input.customerAccountId,
      managedSiteId: input.managedSiteId,
      intentId: intent.id,
      actorUserId: input.actorUserId,
      correlationId: input.correlationId ?? `comms-prep:${intent.id}`,
      idempotencyKey: input.reservationIdempotencyKey ?? `reserve:${input.idempotencyKey}`,
      reservationExpiresAt: new Date(Date.now() + 15 * 60_000),
    })
    if (!reserved.ok) {
      return {
        ok: false,
        code: reserved.code,
        message: reserved.message,
      }
    }
    reservationId = reserved.value.reservationId
  }

  return {
    ok: true,
    value: {
      intentId: intent.id,
      status: intent.status,
      policyDecision,
      dispatchBlocked: true,
      dispatchBlockedCode: auth.value.dispatchBlockedCode || PREPARATION_ONLY_DISPATCH_BLOCKED_CODE,
      chatwootNativeSendBlocked: true,
      quoteId,
      reservationId,
      walletReservationAttempted,
    },
  }
}

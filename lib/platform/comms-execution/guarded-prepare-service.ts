import type { PrismaClient } from '@prisma/client'
import type { CrmConsentChannel, CrmConsentPurpose, CommsDataClassification } from '@prisma/client'
import { isCommsBackendEnabled, isCommsIntegrationGatesEnabled } from '@/config/comms-backend'
import { prisma as defaultPrisma } from '@/lib/db'
import { authorizeOutboundCommunication } from '@/lib/platform/comms/outbound-authorization-gateway'
import { prepareCommsWalletReservation } from '@/lib/platform/comms/wallet-boundary'
import { evaluateChatwootDirectSendBypass } from '@/lib/platform/comms/policy-engine'
import type { CommsResult } from '@/lib/platform/comms/types'
import { loadOutboundAuthorizationInput } from '@/lib/platform/comms-execution/outbound-auth-loader'
import {
  evaluateWalletHoldEligibility,
} from '@/lib/platform/comms-execution/wallet-hold-eligibility'
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
  quoteId?: string
  billingGroupId?: string
  /** When set with quoteId + billingGroupId, attempts wallet hold while outbound remains OFF. */
  reserveWallet?: boolean
  reservationIdempotencyKey?: string
  correlationId?: string
  approvedRegulatedWorkflow?: boolean
  attemptedCrossAccountConversation?: boolean
}

function resolveIntentStatus(input: {
  policyDecision: string
  approvalRequired: boolean
  hasImmutableDbApproval: boolean
  walletHoldEligible: boolean
}): 'DRAFT' | 'BLOCKED' | 'PENDING_APPROVAL' {
  if (
    input.policyDecision === 'DENIED' ||
    input.policyDecision === 'COMPLIANCE_REVIEW_REQUIRED' ||
    input.policyDecision === 'INSUFFICIENT_CREDITS' ||
    input.policyDecision === 'COST_UNAVAILABLE'
  ) {
    return 'BLOCKED'
  }
  // Dispatch/provider NOT_CONFIGURED is preparation-ok when wallet-hold eligibility passes.
  if (input.policyDecision === 'NOT_CONFIGURED' && !input.walletHoldEligible) {
    return 'BLOCKED'
  }
  if (input.approvalRequired && !input.hasImmutableDbApproval) {
    return 'PENDING_APPROVAL'
  }
  if (input.policyDecision === 'REQUIRES_APPROVAL' && !input.hasImmutableDbApproval) {
    return 'PENDING_APPROVAL'
  }
  return 'DRAFT'
}

async function loadImmutableApprovalEvidence(
  db: PrismaClient,
  input: { intentId: string; customerAccountId: string },
): Promise<boolean> {
  const approval = await db.communicationApproval.findFirst({
    where: {
      intentId: input.intentId,
      customerAccountId: input.customerAccountId,
      decision: 'APPROVED',
    },
    select: { id: true },
  })
  return Boolean(approval)
}

async function attemptEligibleWalletReservation(
  db: PrismaClient,
  input: {
    reserveWallet: boolean
    quoteId: string | null
    billingGroupId?: string
    customerAccountId: string
    managedSiteId?: string
    intentId: string
    actorUserId: string
    correlationId?: string
    reservationIdempotencyKey: string
    idempotencyKey: string
    eligibility: ReturnType<typeof evaluateWalletHoldEligibility>
  },
): Promise<CommsResult<{ reservationId: string | null; walletReservationAttempted: boolean }>> {
  if (!input.reserveWallet || !input.quoteId || !input.billingGroupId) {
    return { ok: true, value: { reservationId: null, walletReservationAttempted: false } }
  }
  // Preparation may succeed while a hold is refused. Never invent approval to unlock a hold.
  if (!input.eligibility.eligible) {
    return { ok: true, value: { reservationId: null, walletReservationAttempted: false } }
  }

  const reserved = await prepareCommsWalletReservation(db, {
    billingGroupId: input.billingGroupId,
    customerAccountId: input.customerAccountId,
    managedSiteId: input.managedSiteId,
    intentId: input.intentId,
    actorUserId: input.actorUserId,
    correlationId: input.correlationId ?? `comms-prep:${input.intentId}`,
    idempotencyKey: input.reservationIdempotencyKey,
    reservationExpiresAt: new Date(Date.now() + 15 * 60_000),
  })
  if (!reserved.ok) {
    return { ok: false, code: reserved.code, message: reserved.message }
  }
  return {
    ok: true,
    value: { reservationId: reserved.value.reservationId, walletReservationAttempted: true },
  }
}

/**
 * End-to-end guarded preparation: CRM/consent/sender/wallet facts → outbound auth →
 * durable intent → optional quote bind → optional wallet reservation.
 * Never calls Twilio/Resend/Chatwoot transport. Dispatch remains blocked.
 * Never invents approval evidence from request-body booleans.
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

  const policyDecision = auth.value.policyDecision
  const approvalRequired =
    policyDecision === 'REQUIRES_APPROVAL' ||
    input.purpose === 'MARKETING' ||
    loaded.value.aiActor === true

  const reservationIdempotencyKey = input.reservationIdempotencyKey ?? `reserve:${input.idempotencyKey}`

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

    const hasImmutableDbApproval = await loadImmutableApprovalEvidence(db, {
      intentId: existing.id,
      customerAccountId: input.customerAccountId,
    })
    const eligibility = evaluateWalletHoldEligibility({
      suppressed: loaded.value.suppressed,
      consentStatus: loaded.value.consentStatus,
      purpose: input.purpose,
      channel: input.channel,
      dataClassification: loaded.value.dataClassification,
      approvedRegulatedWorkflow: loaded.value.approvedRegulatedWorkflow,
      senderVerified: loaded.value.senderVerified,
      senderUseCaseRegistered: loaded.value.senderUseCaseRegistered,
      senderIdentityId: loaded.value.senderIdentityId,
      emailDomainVerified: loaded.value.emailDomainVerified,
      walletQuoteAvailable: loaded.value.walletQuoteAvailable,
      approvalRequired: existing.approvalRequired || approvalRequired,
      hasImmutableDbApproval,
      outboundPolicyDecision: existing.policyDecision || policyDecision,
    })

    const reserved = await attemptEligibleWalletReservation(db, {
      reserveWallet: input.reserveWallet === true,
      quoteId: existing.quoteId,
      billingGroupId: input.billingGroupId,
      customerAccountId: input.customerAccountId,
      managedSiteId: input.managedSiteId,
      intentId: existing.id,
      actorUserId: input.actorUserId,
      correlationId: input.correlationId,
      reservationIdempotencyKey,
      idempotencyKey: input.idempotencyKey,
      eligibility,
    })
    if (!reserved.ok) {
      // Failed reservation must not invent APPROVED evidence or mutate intent into approved state.
      return reserved
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
        reservationId: reserved.value.reservationId,
        walletReservationAttempted: reserved.value.walletReservationAttempted,
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

  // New intents never have DB approval yet — do not invent one from request input.
  const hasImmutableDbApproval = false
  const eligibility = evaluateWalletHoldEligibility({
    suppressed: loaded.value.suppressed,
    consentStatus: loaded.value.consentStatus,
    purpose: input.purpose,
    channel: input.channel,
    dataClassification: loaded.value.dataClassification,
    approvedRegulatedWorkflow: loaded.value.approvedRegulatedWorkflow,
    senderVerified: loaded.value.senderVerified,
    senderUseCaseRegistered: loaded.value.senderUseCaseRegistered,
    senderIdentityId: loaded.value.senderIdentityId,
    emailDomainVerified: loaded.value.emailDomainVerified,
    walletQuoteAvailable: loaded.value.walletQuoteAvailable && Boolean(quoteId),
    approvalRequired,
    hasImmutableDbApproval,
    outboundPolicyDecision: policyDecision,
  })

  const status = resolveIntentStatus({
    policyDecision,
    approvalRequired,
    hasImmutableDbApproval,
    walletHoldEligible: eligibility.eligible,
  })

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
      approvalRequired,
      idempotencyKey: input.idempotencyKey,
      recipients: {
        create: {
          customerAccountId: input.customerAccountId,
          crmContactId: input.crmContactId,
          normalizedAddress: loaded.value.normalizedRecipientAddress,
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
        walletHoldEligible: eligibility.eligible,
        walletHoldReason: eligibility.reasonCode,
      },
    },
  })

  const reserved = await attemptEligibleWalletReservation(db, {
    reserveWallet: input.reserveWallet === true,
    quoteId,
    billingGroupId: input.billingGroupId,
    customerAccountId: input.customerAccountId,
    managedSiteId: input.managedSiteId,
    intentId: intent.id,
    actorUserId: input.actorUserId,
    correlationId: input.correlationId,
    reservationIdempotencyKey,
    idempotencyKey: input.idempotencyKey,
    eligibility,
  })
  if (!reserved.ok) {
    return reserved
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
      reservationId: reserved.value.reservationId,
      walletReservationAttempted: reserved.value.walletReservationAttempted,
    },
  }
}

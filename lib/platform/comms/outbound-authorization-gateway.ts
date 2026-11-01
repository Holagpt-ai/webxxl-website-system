import { isCommsIntegrationGatesEnabled } from '@/config/comms-backend'
import { denyBillingGroupSiblingCommsAccess } from '@/lib/platform/comms/account-isolation'
import { evaluateRegulatedWorkflowGate } from '@/lib/platform/comms/data-classification'
import { commsProviderDispatchBlocked } from '@/lib/platform/comms/execution-gates'
import {
  evaluateChatwootDirectSendBypass,
  evaluateCommunicationPolicy,
} from '@/lib/platform/comms/policy-engine'
import type { CommsPolicyDecision, CommsResult } from '@/lib/platform/comms/types'
import type { CrmConsentChannel, CrmConsentPurpose, CommsDataClassification } from '@prisma/client'

export type OutboundAuthorizationInput = {
  customerAccountId: string
  managedSiteId?: string
  actorUserId: string
  channel: CrmConsentChannel
  purpose: CrmConsentPurpose
  recipientAccountId: string
  crmContactId?: string
  consentStatus: 'GRANTED' | 'REVOKED' | 'UNKNOWN' | 'NONE'
  suppressed: boolean
  senderIdentityId?: string
  senderVerified: boolean
  senderUseCaseRegistered: boolean
  emailDomainVerified?: boolean
  dataClassification: CommsDataClassification
  approvedRegulatedWorkflow: boolean
  aiActor: boolean
  humanApprovalGranted?: boolean
  providerConnected: boolean
  walletQuoteAvailable: boolean
  idempotencyKey: string
  contentFingerprint: string
  existingIntentFingerprint?: string
  operatingMemberships: { userId: string; customerAccountId: string }[]
  billingGroupSiblingAccounts: Map<string, string[]>
  attemptedCrossAccountConversation?: boolean
}

export type OutboundAuthorizationResult = {
  policyDecision: CommsPolicyDecision
  dispatchBlocked: boolean
  dispatchBlockedCode: string
  dispatchBlockedMessage: string
  chatwootNativeSendBlocked: boolean
}

function validateIdempotency(input: OutboundAuthorizationInput): CommsResult<true> {
  if (
    input.existingIntentFingerprint &&
    input.existingIntentFingerprint !== input.contentFingerprint
  ) {
    return {
      ok: false,
      code: 'CONFLICT',
      message: 'Idempotency key reused with different content fingerprint',
    }
  }
  return { ok: true, value: true }
}

function validateSenderAndDomain(input: OutboundAuthorizationInput): CommsResult<true> {
  if (!input.senderIdentityId) {
    return { ok: false, code: 'FORBIDDEN', message: 'Sender identity required' }
  }
  if (!input.senderVerified) {
    return { ok: false, code: 'FORBIDDEN', message: 'Sender identity not verified for account' }
  }
  if (!input.senderUseCaseRegistered) {
    return { ok: false, code: 'FORBIDDEN', message: 'Messaging use case not registered for sender' }
  }
  if (input.channel === 'EMAIL' && input.emailDomainVerified === false) {
    return { ok: false, code: 'FORBIDDEN', message: 'Email domain ownership not verified' }
  }
  return { ok: true, value: true }
}

/**
 * Authoritative outbound prep/dispatch authorization boundary (Batch 35).
 * Does not persist intents, quote wallet credits, or call external providers.
 */
export function authorizeOutboundCommunication(
  input: OutboundAuthorizationInput,
): CommsResult<OutboundAuthorizationResult> {
  if (!isCommsIntegrationGatesEnabled()) {
    return {
      ok: false,
      code: 'NOT_CONFIGURED',
      message: 'COMMS_INTEGRATION_GATES_ENABLED is false',
    }
  }

  if (input.attemptedCrossAccountConversation) {
    return { ok: false, code: 'FORBIDDEN', message: 'Cross-tenant conversation access denied' }
  }

  const idem = validateIdempotency(input)
  if (!idem.ok) return idem

  const sibling = denyBillingGroupSiblingCommsAccess({
    actorUserId: input.actorUserId,
    operatingAccountId: input.customerAccountId,
    recordAccountId: input.recipientAccountId,
    operatingMemberships: input.operatingMemberships,
    billingGroupSiblingAccounts: input.billingGroupSiblingAccounts,
  })
  if (!sibling.ok) return sibling

  const regulated = evaluateRegulatedWorkflowGate({
    dataClassification: input.dataClassification,
    channel: input.channel,
    approvedVendorWorkflow: input.approvedRegulatedWorkflow,
  })
  if (regulated !== 'ALLOW_PREPARATION') {
    return {
      ok: true,
      value: {
        policyDecision: regulated,
        dispatchBlocked: true,
        dispatchBlockedCode: regulated,
        dispatchBlockedMessage: 'Regulated or restricted content blocked',
        chatwootNativeSendBlocked: true,
      },
    }
  }

  const senderGate = validateSenderAndDomain(input)
  if (!senderGate.ok) return senderGate

  const policyDecision = evaluateCommunicationPolicy({
    customerAccountId: input.customerAccountId,
    contactId: input.crmContactId,
    channel: input.channel,
    purpose: input.purpose,
    senderAccountId: input.customerAccountId,
    recipientAccountId: input.recipientAccountId,
    consentStatus: input.consentStatus,
    suppressed: input.suppressed,
    providerConnected: input.providerConnected,
    walletQuoteAvailable: input.walletQuoteAvailable,
    dataClassification: input.dataClassification,
    approvedRegulatedWorkflow: input.approvedRegulatedWorkflow,
    aiActor: input.aiActor,
    humanApprovalGranted: input.humanApprovalGranted,
  })

  const chatwootBypass = evaluateChatwootDirectSendBypass()
  const chatwootNativeSendBlocked = chatwootBypass !== 'ALLOW_PREPARATION'
  const dispatchBlock = commsProviderDispatchBlocked()
  const dispatchBlocked = Boolean(dispatchBlock) || chatwootNativeSendBlocked || policyDecision !== 'ALLOW_PREPARATION'

  return {
    ok: true,
    value: {
      policyDecision,
      dispatchBlocked,
      dispatchBlockedCode:
        dispatchBlock && !dispatchBlock.ok
          ? dispatchBlock.code
          : policyDecision !== 'ALLOW_PREPARATION'
            ? policyDecision
            : 'DISPATCH_BLOCKED',
      dispatchBlockedMessage:
        dispatchBlock && !dispatchBlock.ok
          ? dispatchBlock.message
          : 'Live provider dispatch blocked; preparation-only path authorized when policy allows',
      chatwootNativeSendBlocked,
    },
  }
}

/** Retry-safe: dispatch remains blocked; duplicate authorization does not imply duplicate send. */
export function authorizeOutboundDispatchRetry(input: {
  priorDispatchStatus: string
  idempotencyKey: string
  sameFingerprint: boolean
}): CommsResult<{ allowRetry: boolean }> {
  const dispatchBlock = commsProviderDispatchBlocked()
  if (dispatchBlock) {
    return { ok: true, value: { allowRetry: false } }
  }
  if (!input.sameFingerprint) {
    return { ok: false, code: 'CONFLICT', message: 'Retry fingerprint mismatch' }
  }
  if (input.priorDispatchStatus === 'ACCEPTED_BY_PROVIDER' || input.priorDispatchStatus === 'DELIVERED') {
    return { ok: true, value: { allowRetry: false } }
  }
  return { ok: true, value: { allowRetry: true } }
}

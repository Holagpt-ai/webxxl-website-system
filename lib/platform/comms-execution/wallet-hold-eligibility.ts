import type { CrmConsentChannel, CrmConsentPurpose, CommsDataClassification } from '@prisma/client'
import { evaluateRegulatedWorkflowGate } from '@/lib/platform/comms/data-classification'
import type { CommsPolicyDecision } from '@/lib/platform/comms/types'

export type WalletHoldEligibilityInput = {
  suppressed: boolean
  consentStatus: 'GRANTED' | 'REVOKED' | 'UNKNOWN' | 'NONE'
  purpose: CrmConsentPurpose
  channel: CrmConsentChannel
  dataClassification: CommsDataClassification
  approvedRegulatedWorkflow: boolean
  senderVerified: boolean
  senderUseCaseRegistered: boolean
  senderIdentityId?: string
  emailDomainVerified?: boolean
  walletQuoteAvailable: boolean
  approvalRequired: boolean
  /** Must come from durable CommunicationApproval rows — never request body. */
  hasImmutableDbApproval: boolean
  /**
   * Outbound authorize decision. NOT_CONFIGURED from dispatch/provider flags OFF
   * does not by itself prohibit a preparation wallet hold.
   */
  outboundPolicyDecision: CommsPolicyDecision | string
}

export type WalletHoldEligibility =
  | { eligible: true; reasonCode: 'PREPARATION_HOLD_ALLOWED' }
  | { eligible: false; reasonCode: string; message: string }

/**
 * Distinguishes authoritative "not eligible for wallet hold" from "dispatch disabled".
 * Transport may remain OFF while a preparation hold is still allowed.
 */
export function evaluateWalletHoldEligibility(input: WalletHoldEligibilityInput): WalletHoldEligibility {
  if (input.suppressed) {
    return { eligible: false, reasonCode: 'SUPPRESSED', message: 'Suppressed contacts cannot reserve wallet credits' }
  }

  if (
    input.purpose === 'MARKETING' &&
    (input.consentStatus === 'UNKNOWN' || input.consentStatus === 'NONE' || input.consentStatus === 'REVOKED')
  ) {
    return {
      eligible: false,
      reasonCode: 'CONSENT_DENIED',
      message: 'Marketing wallet holds require GRANTED consent',
    }
  }

  const regulated = evaluateRegulatedWorkflowGate({
    dataClassification: input.dataClassification,
    channel: input.channel,
    approvedVendorWorkflow: input.approvedRegulatedWorkflow,
  })
  if (regulated !== 'ALLOW_PREPARATION') {
    return {
      eligible: false,
      reasonCode: regulated,
      message: 'Regulated or restricted content cannot reserve wallet credits',
    }
  }

  if (
    input.outboundPolicyDecision === 'DENIED' ||
    input.outboundPolicyDecision === 'COMPLIANCE_REVIEW_REQUIRED'
  ) {
    return {
      eligible: false,
      reasonCode: String(input.outboundPolicyDecision),
      message: 'Prohibited outbound policy prevents wallet reservation',
    }
  }

  if (!input.senderIdentityId || !input.senderVerified || !input.senderUseCaseRegistered) {
    return {
      eligible: false,
      reasonCode: 'SENDER_INELIGIBLE',
      message: 'Verified sender identity required before wallet reservation',
    }
  }
  if (input.channel === 'EMAIL' && input.emailDomainVerified !== true) {
    return {
      eligible: false,
      reasonCode: 'EMAIL_DOMAIN_UNVERIFIED',
      message: 'Email domain must be verified before wallet reservation',
    }
  }

  if (!input.walletQuoteAvailable) {
    return {
      eligible: false,
      reasonCode: 'QUOTE_UNAVAILABLE',
      message: 'Verified communication quote required before wallet reservation',
    }
  }

  if (input.approvalRequired && !input.hasImmutableDbApproval) {
    return {
      eligible: false,
      reasonCode: 'APPROVAL_REQUIRED',
      message: 'Immutable DB approval evidence required before wallet reservation',
    }
  }

  return { eligible: true, reasonCode: 'PREPARATION_HOLD_ALLOWED' }
}

/** Intent statuses that must never receive a wallet hold. */
export function isProhibitedIntentStatusForWalletHold(status: string, policyDecision: string): boolean {
  if (status === 'BLOCKED') {
    return (
      policyDecision === 'DENIED' ||
      policyDecision === 'COMPLIANCE_REVIEW_REQUIRED' ||
      policyDecision === 'INSUFFICIENT_CREDITS' ||
      policyDecision === 'COST_UNAVAILABLE'
    )
  }
  return false
}

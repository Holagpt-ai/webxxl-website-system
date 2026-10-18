import { isCommunicationsOutboundEnabled, isSmsSendEnabled, isEmailSendEnabled } from '@/config/comms-backend'
import type { CrmConsentChannel, CrmConsentPurpose } from '@prisma/client'
import type { CommsPolicyDecision } from '@/lib/platform/comms/types'
import { evaluateRegulatedWorkflowGate } from '@/lib/platform/comms/data-classification'
import type { CommsDataClassification } from '@prisma/client'

export type PolicyEvaluationInput = {
  customerAccountId: string
  contactId?: string
  channel: CrmConsentChannel
  purpose: CrmConsentPurpose
  senderAccountId: string
  recipientAccountId: string
  consentStatus?: 'GRANTED' | 'REVOKED' | 'UNKNOWN' | 'NONE'
  suppressed: boolean
  providerConnected: boolean
  walletQuoteAvailable: boolean
  dataClassification: CommsDataClassification
  approvedRegulatedWorkflow: boolean
  aiActor: boolean
  humanApprovalGranted?: boolean
}

export function evaluateCommunicationPolicy(input: PolicyEvaluationInput): CommsPolicyDecision {
  const operating = input.customerAccountId
  if (
    input.senderAccountId !== operating ||
    input.recipientAccountId !== operating ||
    input.senderAccountId !== input.recipientAccountId
  ) {
    return 'DENIED'
  }
  const regulated = evaluateRegulatedWorkflowGate({
    dataClassification: input.dataClassification,
    channel: input.channel,
    approvedVendorWorkflow: input.approvedRegulatedWorkflow,
  })
  if (regulated !== 'ALLOW_PREPARATION') return regulated

  if (input.suppressed) return 'DENIED'
  if (input.consentStatus === 'UNKNOWN' || input.consentStatus === 'NONE' || input.consentStatus === 'REVOKED') {
    if (input.purpose === 'MARKETING') return 'DENIED'
  }
  if (!input.providerConnected) return 'NOT_CONFIGURED'
  if (!isCommunicationsOutboundEnabled()) return 'NOT_CONFIGURED'
  if (input.channel === 'SMS' && !isSmsSendEnabled()) return 'NOT_CONFIGURED'
  if (input.channel === 'EMAIL' && !isEmailSendEnabled()) return 'NOT_CONFIGURED'
  if (input.aiActor) return 'REQUIRES_APPROVAL'
  if (!input.walletQuoteAvailable) return 'INSUFFICIENT_CREDITS'
  if (input.purpose === 'MARKETING' && !input.humanApprovalGranted) return 'REQUIRES_APPROVAL'
  return 'ALLOW_PREPARATION'
}

/** Chatwoot-native billable send paths must not bypass WebXXL gateway when outbound is disabled. */
export function evaluateChatwootDirectSendBypass(): CommsPolicyDecision {
  if (!isCommunicationsOutboundEnabled()) return 'NOT_CONFIGURED'
  return 'DENIED'
}

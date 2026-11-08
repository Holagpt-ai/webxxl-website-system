import type { COMMS_EXECUTION_SOURCE_MODULES } from '@/lib/platform/comms-execution/constants'
import type { ChatwootReadinessDto } from '@/lib/platform/comms/chatwoot-readiness-service'
import type { MessagingProviderReadinessDto } from '@/lib/platform/comms/messaging-provider-readiness'
import type { CommsPolicyDecision } from '@/lib/platform/comms/types'

export type CommsExecutionSourceModule = (typeof COMMS_EXECUTION_SOURCE_MODULES)[number]

export type CommsExecutionSlice<T> =
  | {
      status: 'AVAILABLE'
      sourceModule: CommsExecutionSourceModule
      data: T
    }
  | {
      status: 'UNAVAILABLE'
      sourceModule: CommsExecutionSourceModule
      reasonCode: string
      message: string
    }

export type CommsInboxVisibilitySliceData = {
  inboxCount: number
  visibleInboxCount: number
  conversationMappingCount: number
  isolationBoundary: 'CUSTOMER_ACCOUNT'
  billingGroupDoesNotGrantSiblingAccess: true
}

export type CommsWalletGroupBoundarySliceData = {
  walletCommsIntegrationEnabled: boolean
  walletReservationEnabled: boolean
  billingGroupId: string | null
  availableCredits: number | null
  creditType: 'MESSAGING' | null
  attributionBoundary: 'ORIGIN_CUSTOMER_ACCOUNT'
  siblingCrmAccessGranted: false
  note: string
}

export type CommsOutboundPolicyGatesSliceData = {
  integrationGatesEnabled: boolean
  outboundEnabled: boolean
  smsSendEnabled: boolean
  emailSendEnabled: boolean
  chatwootDirectSendBlocked: true
  healthcareUnapprovedProviderBlocked: true
  preparationOnly: true
}

export type CommsDispatchPolicySliceData = {
  dispatchBlocked: true
  dispatchBlockedCode: string
  dispatchBlockedMessage: string
  handoffMode: 'PREPARATION_ONLY'
  chatwootNativeSendBlocked: true
}

export type CommsExecutionSummaryResponse = {
  customerAccountId: string
  managedSiteId: string | null
  assembledAt: string
  accountScope: 'session_membership'
  batchVersion: string
  provenanceNotice: string
  planningDisclosure: string
  inboxVisibility: CommsExecutionSlice<CommsInboxVisibilitySliceData>
  chatwootReadiness: CommsExecutionSlice<
    Pick<
      ChatwootReadinessDto,
      | 'assessedAt'
      | 'moduleEnabled'
      | 'chatwootApiEnabled'
      | 'webhookIngestEnabled'
      | 'inboxCount'
      | 'verifiedInboxCount'
      | 'conversationMappingCount'
      | 'syncState'
      | 'dispatchBlockedMessage'
    >
  >
  messagingProviderReadiness: CommsExecutionSlice<
    Pick<
      MessagingProviderReadinessDto,
      | 'assessedAt'
      | 'twilioAdapterEnabled'
      | 'resendTransportEnabled'
      | 'smsSendEnabled'
      | 'emailSendEnabled'
      | 'senders'
      | 'liveDispatchBlocked'
    >
  >
  walletGroupBoundary: CommsExecutionSlice<CommsWalletGroupBoundarySliceData>
  outboundPolicyGates: CommsExecutionSlice<CommsOutboundPolicyGatesSliceData>
  dispatchPolicy: CommsExecutionSlice<CommsDispatchPolicySliceData>
}

export type GuardedCommsPrepareResult = {
  intentId: string
  status: string
  policyDecision: CommsPolicyDecision | string
  dispatchBlocked: true
  dispatchBlockedCode: string
  chatwootNativeSendBlocked: true
  quoteId: string | null
  reservationId: string | null
  walletReservationAttempted: boolean
}

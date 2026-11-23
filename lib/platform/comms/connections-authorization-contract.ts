import {
  isChatwootApiEnabled,
  isChatwootWebhookIngestEnabled,
  isCommsBackendEnabled,
  isCommsIntegrationGatesEnabled,
  isCommunicationsOutboundEnabled,
} from '@/config/comms-backend'
type ChatwootConnectionSummary = {
  configured: boolean
  verificationState?: string
  authorizedInboxCount: number
  verifiedInboxCount: number
  disconnected: boolean
  mappingPending: boolean
  staleSyncRisk: boolean
  dataState: 'NOT_CONNECTED' | 'PARTIAL' | 'READY' | 'DISCONNECTED'
  summary: string
}

export type CommsInboxAuthorizationRow = {
  inboxMappingId: string
  externalInboxId: string
  verificationState: string
  authorizationState: 'VERIFIED' | 'PENDING' | 'REVOKED' | 'DISCONNECTED'
  liveIngestEnabled: false
  blockReason?: string
}

export type CommsConnectionsAuthorizationContract = {
  assessedAt: string
  moduleEnabled: boolean
  integrationGatesEnabled: boolean
  chatwootApiEnabled: boolean
  webhookIngestEnabled: boolean
  outboundEnabled: boolean
  oauthConnectEnabled: false
  oauthConnectDeferredReason: string
  providerReadinessPath: '/api/v1/communications/provider-readiness'
  executionSummaryPath: '/api/v1/communications/execution/summary'
  dispatchAllowed: false
  inboxes: CommsInboxAuthorizationRow[]
}

function inboxAuthorizationState(
  verificationState: string,
  tenantRevoked: boolean,
  tenantVerificationState: string | null,
): CommsInboxAuthorizationRow['authorizationState'] {
  if (tenantRevoked) return 'REVOKED'
  if (verificationState === 'VERIFIED' && tenantVerificationState === 'VERIFIED') return 'VERIFIED'
  if (verificationState === 'REVOKED') return 'REVOKED'
  if (!tenantVerificationState || tenantVerificationState !== 'VERIFIED') return 'PENDING'
  return 'PENDING'
}

function inboxBlockReason(authState: CommsInboxAuthorizationRow['authorizationState']): string | undefined {
  if (authState === 'VERIFIED') {
    if (!isChatwootApiEnabled()) return 'CHATWOOT_API_ENABLED is false'
    if (!isChatwootWebhookIngestEnabled()) return 'CHATWOOT_WEBHOOK_INGEST_ENABLED is false'
    if (!isCommsIntegrationGatesEnabled()) return 'COMMS_INTEGRATION_GATES_ENABLED is false'
    return 'OWNER_ACTIVATION_REQUIRED'
  }
  if (authState === 'REVOKED') return 'INBOX_OR_TENANT_REVOKED'
  return 'INBOX_MAPPING_PENDING'
}

export function buildCommsConnectionsAuthorizationContract(input: {
  chatwoot: ChatwootConnectionSummary
  inboxes: Array<{
    id: string
    externalInboxId: string
    verificationState: string
    tenantVerificationState: string | null
    tenantRevoked: boolean
  }>
}): CommsConnectionsAuthorizationContract {
  return {
    assessedAt: new Date().toISOString(),
    moduleEnabled: isCommsBackendEnabled(),
    integrationGatesEnabled: isCommsIntegrationGatesEnabled(),
    chatwootApiEnabled: isChatwootApiEnabled(),
    webhookIngestEnabled: isChatwootWebhookIngestEnabled(),
    outboundEnabled: isCommunicationsOutboundEnabled(),
    oauthConnectEnabled: false,
    oauthConnectDeferredReason:
      'Chatwoot tenant install and OAuth connect remain owner-gated; use stored mappings and provider-readiness only.',
    providerReadinessPath: '/api/v1/communications/provider-readiness',
    executionSummaryPath: '/api/v1/communications/execution/summary',
    dispatchAllowed: false,
    inboxes: input.inboxes.map((row) => {
      const authState = inboxAuthorizationState(
        row.verificationState,
        row.tenantRevoked,
        row.tenantVerificationState,
      )
      return {
        inboxMappingId: row.id,
        externalInboxId: row.externalInboxId,
        verificationState: row.verificationState,
        authorizationState: authState,
        liveIngestEnabled: false,
        blockReason: inboxBlockReason(authState),
      }
    }),
  }
}
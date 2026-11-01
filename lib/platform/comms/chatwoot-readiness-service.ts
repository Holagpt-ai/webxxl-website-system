import {
  isChatwootApiEnabled,
  isChatwootWebhookIngestEnabled,
  isCommsIntegrationGatesEnabled,
} from '@/config/comms-backend'
import { prisma } from '@/lib/db'
import { chatwootConnectionState } from '@/lib/platform/comms/connections-service'

export type ChatwootReadinessDto = {
  customerAccountId: string
  assessedAt: string
  moduleEnabled: boolean
  chatwootApiEnabled: boolean
  webhookIngestEnabled: boolean
  tenantMapping?: ReturnType<typeof chatwootConnectionState>
  inboxCount: number
  verifiedInboxCount: number
  conversationMappingCount: number
  syncState: 'NOT_CONNECTED' | 'PARTIAL' | 'READY' | 'DISCONNECTED'
  dispatchBlockedMessage: string
}

export async function buildChatwootIntegrationReadiness(
  customerAccountId: string,
): Promise<
  | { ok: true; value: ChatwootReadinessDto }
  | { ok: false; status: number; code: string; message: string }
> {
  if (!isCommsIntegrationGatesEnabled()) {
    return {
      ok: false,
      status: 503,
      code: 'NOT_CONFIGURED',
      message: 'COMMS_INTEGRATION_GATES_ENABLED is false',
    }
  }

  const assessedAt = new Date()
  const mapping = await prisma.chatwootTenantMapping.findFirst({
    where: { customerAccountId },
    include: { inboxMappings: true },
  })

  const tenant = chatwootConnectionState({
    mapping: mapping
      ? {
          verificationState: mapping.verificationState,
          revokedAt: mapping.revokedAt,
          lastVerifiedAt: mapping.lastVerifiedAt,
          inboxMappings: mapping.inboxMappings.map((row) => ({
            verificationState: row.verificationState,
          })),
        }
      : null,
    apiEnabled: isChatwootApiEnabled(),
  })

  const conversationMappingCount = await prisma.chatwootConversationMapping.count({
    where: { customerAccountId },
  })

  return {
    ok: true,
    value: {
      customerAccountId,
      assessedAt: assessedAt.toISOString(),
      moduleEnabled: true,
      chatwootApiEnabled: isChatwootApiEnabled(),
      webhookIngestEnabled: isChatwootWebhookIngestEnabled(),
      tenantMapping: tenant,
      inboxCount: tenant.authorizedInboxCount,
      verifiedInboxCount: tenant.verifiedInboxCount,
      conversationMappingCount,
      syncState: tenant.dataState,
      dispatchBlockedMessage: 'Outbound and live Chatwoot dispatch remain disabled by default',
    },
  }
}

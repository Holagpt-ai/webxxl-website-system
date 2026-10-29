import { isChatwootApiEnabled, isCommunicationsOutboundEnabled } from '@/config/comms-backend'
import { prisma } from '@/lib/db'
import { createDefaultProviderRegistry } from '@/lib/platform/providers/registry'
import type { CommsResult } from '@/lib/platform/comms/types'

function chatwootConnectionState(input: {
  mapping: {
    verificationState: string
    revokedAt: Date | null
    lastVerifiedAt: Date | null
    inboxMappings: { verificationState: string }[]
  } | null
  apiEnabled: boolean
}): {
  configured: boolean
  verificationState?: string
  authorizedInboxCount: number
  verifiedInboxCount: number
  disconnected: boolean
  mappingPending: boolean
  staleSyncRisk: boolean
  dataState: 'NOT_CONNECTED' | 'PARTIAL' | 'READY' | 'DISCONNECTED'
  summary: string
} {
  if (!input.mapping || !input.apiEnabled) {
    return {
      configured: false,
      authorizedInboxCount: 0,
      verifiedInboxCount: 0,
      disconnected: true,
      mappingPending: false,
      staleSyncRisk: false,
      dataState: 'NOT_CONNECTED',
      summary: 'Chatwoot is not configured for this account',
    }
  }
  if (input.mapping.revokedAt) {
    return {
      configured: true,
      verificationState: input.mapping.verificationState,
      authorizedInboxCount: input.mapping.inboxMappings.length,
      verifiedInboxCount: input.mapping.inboxMappings.filter((i) => i.verificationState === 'VERIFIED').length,
      disconnected: true,
      mappingPending: false,
      staleSyncRisk: false,
      dataState: 'DISCONNECTED',
      summary: 'Chatwoot mapping revoked',
    }
  }
  const verifiedInboxCount = input.mapping.inboxMappings.filter((i) => i.verificationState === 'VERIFIED').length
  const mappingPending = input.mapping.verificationState !== 'VERIFIED'
  const staleSyncRisk =
    !input.mapping.lastVerifiedAt ||
    Date.now() - input.mapping.lastVerifiedAt.getTime() > 7 * 24 * 60 * 60 * 1000

  let dataState: 'PARTIAL' | 'READY' = verifiedInboxCount > 0 ? 'READY' : 'PARTIAL'
  if (mappingPending) dataState = 'PARTIAL'

  return {
    configured: true,
    verificationState: input.mapping.verificationState,
    authorizedInboxCount: input.mapping.inboxMappings.length,
    verifiedInboxCount,
    disconnected: false,
    mappingPending,
    staleSyncRisk,
    dataState,
    summary: mappingPending
      ? 'Chatwoot tenant mapping pending verification'
      : verifiedInboxCount === 0
        ? 'No verified inboxes for this account'
        : 'Chatwoot mapping verified',
  }
}

export async function listCommsConnections(input: {
  customerAccountId: string
  actorUserId: string
}): Promise<
  CommsResult<{
    chatwoot: ReturnType<typeof chatwootConnectionState>
    outbound: { enabled: boolean; dataState: 'DISABLED' | 'ENABLED' }
  }>
> {
  void input.actorUserId
  const mapping = await prisma.chatwootTenantMapping.findFirst({
    where: { customerAccountId: input.customerAccountId, revokedAt: null },
    include: { inboxMappings: true },
  })
  createDefaultProviderRegistry()

  const chatwoot = chatwootConnectionState({ mapping, apiEnabled: isChatwootApiEnabled() })

  return {
    ok: true,
    value: {
      chatwoot,
      outbound: {
        enabled: isCommunicationsOutboundEnabled(),
        dataState: isCommunicationsOutboundEnabled() ? 'ENABLED' : 'DISABLED',
      },
    },
  }
}

import { isChatwootApiEnabled } from '@/config/comms-backend'
import { prisma } from '@/lib/db'
import { createDefaultProviderRegistry } from '@/lib/platform/providers/registry'
import type { CommsResult } from '@/lib/platform/comms/types'

export async function listCommsConnections(input: {
  customerAccountId: string
  actorUserId: string
}): Promise<
  CommsResult<{
    chatwoot: { configured: boolean; verificationState?: string; authorizedInboxCount: number }
    outbound: { enabled: boolean }
  }>
> {
  const mapping = await prisma.chatwootTenantMapping.findFirst({
    where: { customerAccountId: input.customerAccountId, revokedAt: null },
    include: { inboxMappings: true },
  })
  createDefaultProviderRegistry()

  return {
    ok: true,
    value: {
      chatwoot: {
        configured: Boolean(mapping && isChatwootApiEnabled()),
        verificationState: mapping?.verificationState,
        authorizedInboxCount: mapping?.inboxMappings.length ?? 0,
      },
      outbound: { enabled: false },
    },
  }
}

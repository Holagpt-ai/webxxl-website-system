import { COMMS_CONVERSATION_STALE_MINUTES } from '@/config/comms-backend'
import { prisma } from '@/lib/db'
import { resolveInboxVisibilityState, type CommsInboxVisibilityState } from '@/lib/platform/comms/inbox-visibility'
import type { CommsResult } from '@/lib/platform/comms/types'

export type CommsInboxRow = {
  id: string
  externalInboxId: string
  channelType: string | null
  verificationState: string
  tenantVerificationState: string | null
  tenantRevoked: boolean
  visibilityState: CommsInboxVisibilityState
  lastSyncAt: string | null
  syncStale: boolean
}

export async function listAccountInboxes(input: { customerAccountId: string }): Promise<CommsResult<{ inboxes: CommsInboxRow[] }>> {
  const rows = await prisma.chatwootInboxMapping.findMany({
    where: { customerAccountId: input.customerAccountId },
    include: {
      tenantMapping: { select: { verificationState: true, revokedAt: true, lastVerifiedAt: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })
  const now = Date.now()
  const staleMs = COMMS_CONVERSATION_STALE_MINUTES * 60_000

  return {
    ok: true,
    value: {
      inboxes: rows.map((row) => {
        const lastVerified = row.tenantMapping.lastVerifiedAt
        const syncStale = !lastVerified || now - lastVerified.getTime() > staleMs
        const tenantRevoked = row.tenantMapping.revokedAt != null
        return {
          id: row.id,
          externalInboxId: row.externalInboxId,
          channelType: row.channelType,
          verificationState: row.verificationState,
          tenantVerificationState: row.tenantMapping.verificationState,
          tenantRevoked,
          visibilityState: resolveInboxVisibilityState({
            tenantRevoked,
            tenantVerificationState: row.tenantMapping.verificationState,
            inboxVerificationState: row.verificationState,
            syncStale,
          }),
          lastSyncAt: lastVerified?.toISOString() ?? null,
          syncStale,
        }
      }),
    },
  }
}

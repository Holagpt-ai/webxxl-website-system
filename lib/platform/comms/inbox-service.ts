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
      tenantMapping: { select: { verificationState: true, revokedAt: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })

  const syncByInbox = await prisma.chatwootConversationMapping.groupBy({
    by: ['externalInboxId'],
    where: { customerAccountId: input.customerAccountId, lastSyncAt: { not: null } },
    _max: { lastSyncAt: true },
  })
  const lastSyncByExternalInbox = new Map(
    syncByInbox.map((row) => [row.externalInboxId, row._max.lastSyncAt] as const),
  )

  const now = Date.now()
  const staleMs = COMMS_CONVERSATION_STALE_MINUTES * 60_000

  return {
    ok: true,
    value: {
      inboxes: rows.map((row) => {
        const lastSyncAt = lastSyncByExternalInbox.get(row.externalInboxId) ?? null
        const syncStale = lastSyncAt != null && now - lastSyncAt.getTime() > staleMs
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
          lastSyncAt: lastSyncAt?.toISOString() ?? null,
          syncStale,
        }
      }),
    },
  }
}

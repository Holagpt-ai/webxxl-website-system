import type { SocialStore } from '@/lib/platform/social/in-memory-store'
import type { SocialResult } from '@/lib/platform/social/types'

export function validateTargetChannelIdsForAccount(
  store: SocialStore,
  customerAccountId: string,
  managedSiteId: string | undefined,
  targetChannelIds: string[],
): SocialResult<true> {
  for (const channelId of targetChannelIds) {
    const connection = store.connections.get(channelId)
    if (!connection) {
      return { ok: false, code: 'CHANNEL_NOT_FOUND', message: 'Target channel not found' }
    }
    if (connection.customerAccountId !== customerAccountId) {
      return { ok: false, code: 'CROSS_ACCOUNT_DENIED', message: 'Target channel belongs to another account' }
    }
    if (managedSiteId && connection.managedSiteId && connection.managedSiteId !== managedSiteId) {
      return {
        ok: false,
        code: 'SITE_SCOPE_MISMATCH',
        message: 'Target channel is not authorized for managed site scope',
      }
    }
    if (connection.connectionState === 'REVOKED' || connection.connectionState === 'EXPIRED') {
      return { ok: false, code: 'CHANNEL_REVOKED', message: 'Target channel is not active' }
    }
  }
  return { ok: true, value: true }
}

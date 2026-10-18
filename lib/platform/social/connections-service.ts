import type { SocialStore } from '@/lib/platform/social/in-memory-store'
import type { BusinessSocialConnectionRecord, SocialResult } from '@/lib/platform/social/types'

export function getConnectionForAccount(
  store: SocialStore,
  connectionId: string,
  customerAccountId: string,
): SocialResult<BusinessSocialConnectionRecord> {
  const connection = store.connections.get(connectionId)
  if (!connection) return { ok: false, code: 'NOT_FOUND', message: 'Social connection not found' }
  if (connection.customerAccountId !== customerAccountId) {
    return { ok: false, code: 'CROSS_ACCOUNT_DENIED', message: 'Connection belongs to another account' }
  }
  return { ok: true, value: connection }
}

export function listConnectionsForAccount(
  store: SocialStore,
  customerAccountId: string,
  managedSiteId?: string,
): BusinessSocialConnectionRecord[] {
  return [...store.connections.values()].filter((row) => {
    if (row.customerAccountId !== customerAccountId) return false
    if (managedSiteId && row.managedSiteId && row.managedSiteId !== managedSiteId) return false
    return true
  })
}

export function assertChannelDispatchAllowed(connection: BusinessSocialConnectionRecord): SocialResult<true> {
  if (connection.connectionState === 'REVOKED' || connection.connectionState === 'EXPIRED') {
    return { ok: false, code: 'CHANNEL_REVOKED', message: 'Social channel is revoked or expired' }
  }
  if (connection.connectionState !== 'CONNECTED') {
    return { ok: false, code: 'CHANNEL_NOT_CONNECTED', message: 'Social channel is not connected' }
  }
  return { ok: true, value: true }
}

/** Billing group membership does not grant operating access to sibling channels. */
export function denyBillingGroupSiblingAccess(
  store: SocialStore,
  userId: string,
  targetAccountId: string,
  connectionAccountId: string,
): SocialResult<true> {
  if (targetAccountId === connectionAccountId) return { ok: true, value: true }
  const hasDirect = store.operatingMemberships.some(
    (m) => m.userId === userId && m.customerAccountId === connectionAccountId,
  )
  if (hasDirect) return { ok: true, value: true }
  for (const siblings of store.billingGroupSiblingAccounts.values()) {
    if (siblings.includes(targetAccountId) && siblings.includes(connectionAccountId)) {
      return {
        ok: false,
        code: 'BILLING_GROUP_NOT_AUTHORIZATION',
        message: 'Billing group does not grant sibling social channel access',
      }
    }
  }
  return { ok: false, code: 'UNAUTHORIZED', message: 'No operating access to connection account' }
}

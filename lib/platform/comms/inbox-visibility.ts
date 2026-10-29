export type CommsInboxVisibilityState =
  | 'NOT_CONFIGURED'
  | 'MAPPING_PENDING'
  | 'VERIFIED'
  | 'DISCONNECTED'
  | 'STALE_SYNC'

export function resolveInboxVisibilityState(input: {
  tenantRevoked: boolean
  tenantVerificationState: string | null
  inboxVerificationState: string
  syncStale?: boolean
}): CommsInboxVisibilityState {
  if (input.tenantRevoked) return 'DISCONNECTED'
  if (input.tenantVerificationState !== 'VERIFIED') return 'MAPPING_PENDING'
  if (input.inboxVerificationState === 'VERIFIED') {
    return input.syncStale ? 'STALE_SYNC' : 'VERIFIED'
  }
  return 'MAPPING_PENDING'
}

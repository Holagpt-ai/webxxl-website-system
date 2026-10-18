import type { CommsResult } from '@/lib/platform/comms/types'

/** Billing group wallet sharing does not grant sibling conversation or inbox access. */
export function denyBillingGroupSiblingCommsAccess(input: {
  actorUserId: string
  operatingAccountId: string
  recordAccountId: string
  operatingMemberships: { userId: string; customerAccountId: string }[]
  billingGroupSiblingAccounts: Map<string, string[]>
}): CommsResult<true> {
  if (input.operatingAccountId === input.recordAccountId) return { ok: true, value: true }
  const direct = input.operatingMemberships.some(
    (m) => m.userId === input.actorUserId && m.customerAccountId === input.recordAccountId,
  )
  if (direct) return { ok: true, value: true }
  for (const siblings of input.billingGroupSiblingAccounts.values()) {
    if (siblings.includes(input.operatingAccountId) && siblings.includes(input.recordAccountId)) {
      return {
        ok: false,
        code: 'FORBIDDEN',
        message: 'Billing group does not grant sibling communications access',
      }
    }
  }
  return { ok: false, code: 'FORBIDDEN', message: 'No operating access to communications record account' }
}

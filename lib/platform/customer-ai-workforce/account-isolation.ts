import type { CustomerAiResult } from '@/lib/platform/customer-ai-workforce/types'

/** Billing group membership does not grant Customer AI employee or task access to sibling accounts. */
export function denyBillingGroupSiblingCustomerAiAccess(input: {
  actorUserId: string
  operatingAccountId: string
  recordAccountId: string
  operatingMemberships: Array<{ userId: string; customerAccountId: string }>
  billingGroupSiblingAccounts: Map<string, string[]>
}): CustomerAiResult<true> {
  if (input.operatingAccountId === input.recordAccountId) {
    return { ok: true, value: true }
  }
  const hasDirect = input.operatingMemberships.some(
    (m) => m.userId === input.actorUserId && m.customerAccountId === input.recordAccountId,
  )
  if (hasDirect) return { ok: true, value: true }
  for (const siblings of input.billingGroupSiblingAccounts.values()) {
    if (siblings.includes(input.operatingAccountId) && siblings.includes(input.recordAccountId)) {
      return {
        ok: false,
        error: 'FORBIDDEN',
        message: 'Billing group does not grant sibling Customer AI access',
      }
    }
  }
  return { ok: false, error: 'FORBIDDEN', message: 'No operating access to target account' }
}

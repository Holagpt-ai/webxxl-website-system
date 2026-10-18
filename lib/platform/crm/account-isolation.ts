import type { CrmResult } from '@/lib/platform/crm/types'

/** Billing group membership does not grant CRM access to sibling accounts. */
export function denyBillingGroupSiblingCrmAccess(input: {
  actorUserId: string
  targetAccountId: string
  recordAccountId: string
  operatingMemberships: { userId: string; customerAccountId: string }[]
  billingGroupSiblingAccounts: Map<string, string[]>
}): CrmResult<true> {
  if (input.targetAccountId === input.recordAccountId) return { ok: true, value: true }
  const direct = input.operatingMemberships.some(
    (m) => m.userId === input.actorUserId && m.customerAccountId === input.recordAccountId,
  )
  if (direct) return { ok: true, value: true }
  for (const siblings of input.billingGroupSiblingAccounts.values()) {
    if (siblings.includes(input.targetAccountId) && siblings.includes(input.recordAccountId)) {
      return {
        ok: false,
        code: 'BILLING_GROUP_NOT_AUTHORIZATION',
        message: 'Billing group does not grant sibling CRM access',
      }
    }
  }
  return { ok: false, code: 'FORBIDDEN', message: 'No operating access to CRM record account' }
}

export function assertSameCustomerAccount(
  expectedAccountId: string,
  recordAccountId: string,
): CrmResult<true> {
  if (expectedAccountId !== recordAccountId) {
    return { ok: false, code: 'CROSS_ACCOUNT_DENIED', message: 'CRM record belongs to another account' }
  }
  return { ok: true, value: true }
}

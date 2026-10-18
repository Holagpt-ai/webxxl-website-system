import type { SeoResult } from '@/lib/platform/seo/types'

/** Billing group membership does not grant SEO access to sibling accounts. */
export function denyBillingGroupSiblingSeoAccess(input: {
  actorUserId: string
  operatingAccountId: string
  recordAccountId: string
  operatingMemberships: { userId: string; customerAccountId: string }[]
  billingGroupSiblingAccounts: Map<string, string[]>
}): SeoResult<true> {
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
        message: 'Billing group does not grant sibling SEO access',
      }
    }
  }
  return { ok: false, code: 'FORBIDDEN', message: 'No operating access to SEO record account' }
}

export function assertSameSeoAccount(expectedAccountId: string, recordAccountId: string): SeoResult<true> {
  if (expectedAccountId !== recordAccountId) {
    return { ok: false, code: 'FORBIDDEN', message: 'SEO record belongs to another account' }
  }
  return { ok: true, value: true }
}

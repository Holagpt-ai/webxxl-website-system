import { assertSameSeoAccount, denyBillingGroupSiblingSeoAccess } from '@/lib/platform/seo/account-isolation'
import type { AnalyticsResult } from '@/lib/platform/analytics/types'

/** Billing group membership must not expose sibling analytics. */
export function denyBillingGroupSiblingAnalyticsAccess(input: {
  actorUserId: string
  operatingAccountId: string
  recordAccountId: string
  operatingMemberships: { userId: string; customerAccountId: string }[]
  billingGroupSiblingAccounts: Map<string, string[]>
}): AnalyticsResult<true> {
  const seo = denyBillingGroupSiblingSeoAccess(input)
  if (!seo.ok) return { ok: false, error: 'FORBIDDEN', message: seo.message }
  return { ok: true, value: true }
}

export function assertSameAnalyticsAccount(
  expectedAccountId: string,
  recordAccountId: string,
): AnalyticsResult<true> {
  const seo = assertSameSeoAccount(expectedAccountId, recordAccountId)
  if (!seo.ok) return { ok: false, error: 'FORBIDDEN', message: seo.message }
  return { ok: true, value: true }
}

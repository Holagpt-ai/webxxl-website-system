import type { MktResult } from '@/lib/platform/marketing/types'

export function denyBillingGroupSiblingMarketingAccess(input: {
  operatingAccountId: string
  recordAccountId: string
  billingGroupSiblingAccounts: Map<string, string[]>
}): MktResult<true> {
  if (input.operatingAccountId === input.recordAccountId) return { ok: true, value: true }
  for (const siblings of input.billingGroupSiblingAccounts.values()) {
    if (siblings.includes(input.operatingAccountId) && siblings.includes(input.recordAccountId)) {
      return { ok: false, code: 'FORBIDDEN', message: 'Billing group does not grant sibling marketing access' }
    }
  }
  return { ok: true, value: true }
}

export async function assertManagedSiteInAccount(input: {
  siteId: string | null | undefined
  customerAccountId: string
  loadSite: (siteId: string, accountId: string) => Promise<{ id: string; customerAccountId: string } | null>
}): Promise<MktResult<{ siteId: string }>> {
  if (!input.siteId) return { ok: false, code: 'VALIDATION', message: 'Managed site required' }
  const site = await input.loadSite(input.siteId, input.customerAccountId)
  if (!site) return { ok: false, code: 'FORBIDDEN', message: 'Managed site not found for account' }
  return { ok: true, value: { siteId: site.id } }
}

import { marketingStudioDefaultPeriodKey, marketingStudioQuotaPolicy } from '@/config/social-marketing'
import { nextSocialId, type SocialStore } from '@/lib/platform/social/in-memory-store'
import { assertValidQuotaPolicy } from '@/lib/platform/social/quota-policy'
import type { SocialResult } from '@/lib/platform/social/types'

function usageCount(store: SocialStore, customerAccountId: string, periodKey: string, operation: string): number {
  return store.usage
    .filter((row) => row.customerAccountId === customerAccountId && row.periodKey === periodKey && row.operation === operation)
    .reduce((sum, row) => sum + row.units, 0)
}

export function recordMarketingStudioUsage(
  store: SocialStore,
  input: {
    customerAccountId: string
    managedSiteId?: string
    operation: string
    units?: number
    source: string
    idempotencyKey?: string
    periodKey?: string
  },
): SocialResult<{ recorded: true }> {
  const periodKey = input.periodKey ?? marketingStudioDefaultPeriodKey()
  if (input.idempotencyKey) {
    const dup = store.usage.some((row) => row.idempotencyKey === input.idempotencyKey)
    if (dup) return { ok: true, value: { recorded: true } }
  }
  store.usage.push({
    id: nextSocialId('mktusage'),
    customerAccountId: input.customerAccountId,
    managedSiteId: input.managedSiteId,
    periodKey,
    operation: input.operation,
    units: input.units ?? 1,
    source: input.source,
    idempotencyKey: input.idempotencyKey,
    createdAt: new Date(),
  })
  return { ok: true, value: { recorded: true } }
}

export function assertWithinQuota(
  store: SocialStore,
  customerAccountId: string,
  operation: 'draft' | 'schedule' | 'content_plan' | 'postiz_api',
): SocialResult<true> {
  const policyCheck = assertValidQuotaPolicy()
  if (!policyCheck.ok) return policyCheck
  const policy = policyCheck.value
  const periodKey = marketingStudioDefaultPeriodKey()
  const map = {
    draft: policy.draftsPerAccountMonth,
    schedule: policy.schedulingRequestsPerAccountMonth,
    content_plan: policy.contentPlansPerAccountMonth,
    postiz_api: policy.providerApiCallsPerAccountMonth,
  } as const
  const used = usageCount(store, customerAccountId, periodKey, operation)
  if (used >= map[operation]) {
    return { ok: false, code: 'QUOTA_EXCEEDED', message: `FREE Marketing Studio ${operation} quota exceeded` }
  }
  return { ok: true, value: true }
}

import { marketingStudioQuotaPolicy, type MarketingStudioQuotaPolicy } from '@/config/social-marketing'
import type { SocialResult } from '@/lib/platform/social/types'

export function assertValidQuotaPolicy(): SocialResult<MarketingStudioQuotaPolicy> {
  const policy = marketingStudioQuotaPolicy()
  const fields: (keyof MarketingStudioQuotaPolicy)[] = [
    'draftsPerAccountMonth',
    'schedulingRequestsPerAccountMonth',
    'maxConnectedChannels',
    'contentPlansPerAccountMonth',
    'providerApiCallsPerAccountMonth',
  ]
  for (const field of fields) {
    const value = policy[field]
    if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
      return {
        ok: false,
        code: 'INVALID_QUOTA_CONFIG',
        message: `Invalid quota configuration for ${field}`,
      }
    }
  }
  return { ok: true, value: policy }
}

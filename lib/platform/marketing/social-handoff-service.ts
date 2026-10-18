import { isPostizLivePublishingEnabled, isSocialMarketingEnabled } from '@/config/social-marketing'
import { isMktExternalHandoffEnabled } from '@/config/mkt-backend'
import type { MktResult } from '@/lib/platform/marketing/types'

/** Prepare social-compatible references without scheduling Postiz. */
export function prepareSocialHandoffFromApprovedCreative(input: {
  revisionHash: string
  approved: boolean
  channel?: string
}): MktResult<{ handoffState: 'PREPARED' | 'BLOCKED'; schedulingAllowed: false }> {
  if (!isMktExternalHandoffEnabled() || !isSocialMarketingEnabled()) {
    return {
      ok: true,
      value: { handoffState: 'BLOCKED', schedulingAllowed: false },
    }
  }
  if (!input.approved) {
    return { ok: false, code: 'FORBIDDEN', message: 'Social handoff requires approved revision' }
  }
  if (isPostizLivePublishingEnabled()) {
    return { ok: false, code: 'NOT_CONFIGURED', message: 'Live Postiz publishing remains disabled in MKT-08' }
  }
  return {
    ok: true,
    value: { handoffState: 'PREPARED', schedulingAllowed: false },
  }
}

import { isSocialMarketingEnabled } from '@/config/social-marketing'
import {
  requireIncludedFreeSoftwareMembershipKeys,
  SOCIAL_INCLUDED_FREE_ENTITLEMENT_KEYS,
} from '@/lib/platform/open001/module-api-gate'
import { resolveTrustedSocialApprover } from '@/lib/platform/social/operator-auth'
import type { SocialStore } from '@/lib/platform/social/in-memory-store'

export class SocialApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = 'DENIED',
  ) {
    super(message)
    this.name = 'SocialApiError'
  }
}

export async function requireSocialApiActor() {
  if (!isSocialMarketingEnabled()) {
    throw new SocialApiError(403, 'Social Marketing Studio backend is disabled', 'SOCIAL_MARKETING_DISABLED')
  }
  const portal = await requireIncludedFreeSoftwareMembershipKeys(
    SOCIAL_INCLUDED_FREE_ENTITLEMENT_KEYS,
    SocialApiError,
  )
  return {
    userId: portal.id,
    customerAccountId: portal.customerAccount.id,
    managedSiteId: undefined as string | undefined,
  }
}

export function requireTrustedSocialApproverFromSession(
  store: SocialStore,
  userId: string,
) {
  const trusted = resolveTrustedSocialApprover(store, userId)
  if (!trusted.ok) {
    throw new SocialApiError(403, trusted.message, trusted.code)
  }
  return trusted.value
}

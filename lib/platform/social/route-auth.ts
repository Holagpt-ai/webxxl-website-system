import { isSocialMarketingEnabled } from '@/config/social-marketing'
import { requireCustomerMembership } from '@/lib/portal/authz'
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
  const portal = await requireCustomerMembership()
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

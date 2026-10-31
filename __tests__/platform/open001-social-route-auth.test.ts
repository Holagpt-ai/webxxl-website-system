import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { evaluateIncludedFreeAccessForAccount } from '@/lib/platform/open001/included-free-access'
import {
  emptySubscriberEvidence,
  WEBSITE_SUBSCRIPTION_PRODUCT_KEY,
} from '@/lib/platform/open001/subscriber-evidence'
import { requireSocialApiActor, SocialApiError } from '@/lib/platform/social/route-auth'

const SUBSCRIBER = 'acct_social_subscriber'
const NON_SUBSCRIBER = 'acct_social_non_subscriber'
const SIBLING = 'acct_social_sibling'

vi.mock('@/lib/portal/authz', () => ({
  requireCustomerMembership: vi.fn(),
}))

vi.mock('@/lib/platform/open001/load-subscriber-evidence', () => ({
  loadSubscriberEvidenceForAccount: vi.fn(),
}))

import { requireCustomerMembership } from '@/lib/portal/authz'
import { loadSubscriberEvidenceForAccount } from '@/lib/platform/open001/load-subscriber-evidence'

function portalFor(accountId: string) {
  return {
    id: 'user_test',
    role: 'CUSTOMER' as const,
    membership: { role: 'OWNER' as const },
    customerAccount: { id: accountId },
  }
}

describe('Social API OPEN-001 gates (Batch 22A)', () => {
  beforeEach(() => {
    vi.stubEnv('SOCIAL_MARKETING_ENABLED', 'true')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  it('denies non-subscriber at requireSocialApiActor', async () => {
    vi.mocked(requireCustomerMembership).mockResolvedValue(portalFor(NON_SUBSCRIBER) as never)
    vi.mocked(loadSubscriberEvidenceForAccount).mockResolvedValue({
      ...emptySubscriberEvidence(NON_SUBSCRIBER),
      loadOutcome: 'ok',
    })
    await expect(requireSocialApiActor()).rejects.toMatchObject({
      code: 'FREE_SOFTWARE_NOT_ELIGIBLE',
      status: 403,
    })
  })

  it('allows qualifying subscriber for social and marketing-studio entitlements', async () => {
    vi.mocked(requireCustomerMembership).mockResolvedValue(portalFor(SUBSCRIBER) as never)
    vi.mocked(loadSubscriberEvidenceForAccount).mockResolvedValue({
      ...emptySubscriberEvidence(SUBSCRIBER),
      subscriptions: [
        {
          customerAccountId: SUBSCRIBER,
          productKey: WEBSITE_SUBSCRIPTION_PRODUCT_KEY,
          status: 'ACTIVE',
        },
      ],
      loadOutcome: 'ok',
    })
    const actor = await requireSocialApiActor()
    expect(actor.customerAccountId).toBe(SUBSCRIBER)
  })

  it('denies after subscription becomes nonqualifying (cancelled)', async () => {
    vi.mocked(requireCustomerMembership).mockResolvedValue(portalFor(SUBSCRIBER) as never)
    vi.mocked(loadSubscriberEvidenceForAccount).mockResolvedValue({
      ...emptySubscriberEvidence(SUBSCRIBER),
      subscriptions: [
        {
          customerAccountId: SUBSCRIBER,
          productKey: WEBSITE_SUBSCRIPTION_PRODUCT_KEY,
          status: 'CANCELLED',
        },
      ],
      loadOutcome: 'ok',
    })
    await expect(requireSocialApiActor()).rejects.toMatchObject({
      code: 'FREE_SOFTWARE_NOT_ELIGIBLE',
    })
  })

  it('does not grant sibling account access from another account subscription evidence', async () => {
    vi.mocked(requireCustomerMembership).mockResolvedValue(portalFor(SIBLING) as never)
    vi.mocked(loadSubscriberEvidenceForAccount).mockResolvedValue({
      ...emptySubscriberEvidence(SIBLING),
      subscriptions: [
        {
          customerAccountId: SUBSCRIBER,
          productKey: WEBSITE_SUBSCRIPTION_PRODUCT_KEY,
          status: 'ACTIVE',
        },
      ],
      loadOutcome: 'ok',
    })
    await expect(requireSocialApiActor()).rejects.toMatchObject({
      code: 'FREE_SOFTWARE_NOT_ELIGIBLE',
    })
  })

  it('returns SOCIAL_MARKETING_DISABLED before OPEN-001 when backend flag is off', async () => {
    vi.stubEnv('SOCIAL_MARKETING_ENABLED', 'false')
    await expect(requireSocialApiActor()).rejects.toMatchObject({
      code: 'SOCIAL_MARKETING_DISABLED',
      status: 403,
    })
    expect(requireCustomerMembership).not.toHaveBeenCalled()
  })

  it('requires both core.social-automation and core.marketing-studio for included-free access', () => {
    const evidence = {
      ...emptySubscriberEvidence(SUBSCRIBER),
      subscriptions: [
        {
          customerAccountId: SUBSCRIBER,
          productKey: WEBSITE_SUBSCRIPTION_PRODUCT_KEY,
          status: 'ACTIVE' as const,
        },
      ],
      loadOutcome: 'ok' as const,
    }
    for (const key of ['core.social-automation', 'core.marketing-studio'] as const) {
      const decision = evaluateIncludedFreeAccessForAccount({
        entitlementKey: key,
        customerAccountId: SUBSCRIBER,
        evidence,
      })
      expect(decision.allowed).toBe(true)
    }
  })

  it('throws SocialApiError type for entitlement denial', async () => {
    vi.mocked(requireCustomerMembership).mockResolvedValue(portalFor(NON_SUBSCRIBER) as never)
    vi.mocked(loadSubscriberEvidenceForAccount).mockResolvedValue({
      ...emptySubscriberEvidence(NON_SUBSCRIBER),
      loadOutcome: 'ok',
    })
    await expect(requireSocialApiActor()).rejects.toBeInstanceOf(SocialApiError)
  })
})

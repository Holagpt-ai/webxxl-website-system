import { afterEach, describe, expect, it, vi } from 'vitest'
import { evaluateEntitlementAccess, getServiceEntitlement } from '@/lib/platform/entitlements'
import { evaluateIncludedFreeAccessForAccount } from '@/lib/platform/open001/included-free-access'
import {
  getOpen001FreeSoftwareCohort,
  isOpen001PolicyResolved,
  OPEN001_DECISION,
} from '@/lib/platform/open001/policy'
import {
  emptySubscriberEvidence,
  WEBSITE_SUBSCRIPTION_PRODUCT_KEY,
  LEGACY_WEBSITE_SUBSCRIBER_SERVICE_KEY,
} from '@/lib/platform/open001/subscriber-evidence'
import { resolveSubscriberEligibility } from '@/lib/platform/open001/subscriber-eligibility'

const ACCOUNT_A = 'acct_pilot_subscriber'
const ACCOUNT_B = 'acct_pilot_non_subscriber'
const SIBLING = 'acct_billing_sibling'

function activeSubscription(accountId: string) {
  return {
    customerAccountId: accountId,
    productKey: WEBSITE_SUBSCRIPTION_PRODUCT_KEY,
    status: 'ACTIVE' as const,
  }
}

describe('OPEN-001 policy (Batch 21B)', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('records owner-approved SUBSCRIBER_ONLY as active cohort', () => {
    expect(OPEN001_DECISION.status).toBe('RESOLVED_OWNER_APPROVED')
    expect(isOpen001PolicyResolved()).toBe(true)
    expect(getOpen001FreeSoftwareCohort()).toBe('SUBSCRIBER_ONLY')
  })

  it('does not report core pilot entitlements as POLICY_UNRESOLVED at source', () => {
    for (const key of [
      'core.crm',
      'core.marketing-studio',
      'core.local-seo',
      'core.communications',
    ] as const) {
      const ent = getServiceEntitlement(key)!
      expect(evaluateEntitlementAccess(ent).access).toBe('INCLUDED')
    }
  })

  it('qualifies active website subscriber on same CustomerAccount', () => {
    const evidence = {
      ...emptySubscriberEvidence(ACCOUNT_A),
      subscriptions: [activeSubscription(ACCOUNT_A)],
      loadOutcome: 'ok' as const,
    }
    expect(resolveSubscriberEligibility(ACCOUNT_A, evidence).outcome).toBe('QUALIFIED')
    const decision = evaluateIncludedFreeAccessForAccount({
      entitlementKey: 'core.crm',
      customerAccountId: ACCOUNT_A,
      evidence,
    })
    expect(decision.allowed).toBe(true)
  })

  it('denies non-subscriber with valid login context (no subscription rows)', () => {
    const evidence = { ...emptySubscriberEvidence(ACCOUNT_B), loadOutcome: 'ok' as const }
    const decision = evaluateIncludedFreeAccessForAccount({
      entitlementKey: 'core.crm',
      customerAccountId: ACCOUNT_B,
      evidence,
    })
    expect(decision.allowed).toBe(false)
    if (!decision.allowed) {
      expect(decision.code).toBe('FREE_SOFTWARE_NOT_ELIGIBLE')
      expect(decision.httpStatus).toBe(403)
    }
  })

  it('does not entitle billing-group sibling from another account subscription', () => {
    const evidence = {
      ...emptySubscriberEvidence(SIBLING),
      subscriptions: [activeSubscription(ACCOUNT_A)],
      loadOutcome: 'ok' as const,
    }
    expect(resolveSubscriberEligibility(SIBLING, evidence).outcome).toBe('NOT_ELIGIBLE')
  })

  it('denies cancelled and paused subscriptions', () => {
    for (const status of ['CANCELLED', 'PAUSED', 'INCOMPLETE'] as const) {
      const evidence = {
        ...emptySubscriberEvidence(ACCOUNT_A),
        subscriptions: [{ customerAccountId: ACCOUNT_A, productKey: WEBSITE_SUBSCRIPTION_PRODUCT_KEY, status }],
        loadOutcome: 'ok' as const,
      }
      expect(resolveSubscriberEligibility(ACCOUNT_A, evidence).outcome).toBe('NOT_ELIGIBLE')
    }
  })

  it('allows cancel-scheduled and past-due per commerce subscription semantics', () => {
    for (const status of ['CANCEL_SCHEDULED', 'PAST_DUE'] as const) {
      const evidence = {
        ...emptySubscriberEvidence(ACCOUNT_A),
        subscriptions: [{ customerAccountId: ACCOUNT_A, productKey: WEBSITE_SUBSCRIPTION_PRODUCT_KEY, status }],
        loadOutcome: 'ok' as const,
      }
      expect(resolveSubscriberEligibility(ACCOUNT_A, evidence).outcome).toBe('QUALIFIED')
    }
  })

  it('accepts reconciled legacy CustomerService evidence only for paid.website-subscription', () => {
    const evidence = {
      ...emptySubscriberEvidence(ACCOUNT_A),
      legacyWebsiteServices: [
        {
          customerAccountId: ACCOUNT_A,
          serviceKey: LEGACY_WEBSITE_SUBSCRIBER_SERVICE_KEY,
          status: 'ACTIVE',
        },
      ],
      loadOutcome: 'ok' as const,
    }
    expect(resolveSubscriberEligibility(ACCOUNT_A, evidence).outcome).toBe('QUALIFIED')
  })

  it('does not treat hosting-only CustomerService as subscriber eligibility', () => {
    const evidence = {
      ...emptySubscriberEvidence(ACCOUNT_A),
      legacyWebsiteServices: [
        { customerAccountId: ACCOUNT_A, serviceKey: 'hosting', status: 'ACTIVE' },
      ],
      loadOutcome: 'ok' as const,
    }
    expect(resolveSubscriberEligibility(ACCOUNT_A, evidence).outcome).toBe('NOT_ELIGIBLE')
  })

  it('flags ambiguous legacy website evidence for owner reconciliation', () => {
    const evidence = {
      ...emptySubscriberEvidence(ACCOUNT_A),
      legacyWebsiteServices: [
        {
          customerAccountId: ACCOUNT_A,
          serviceKey: 'hosting',
          status: 'PENDING',
          metadata: { websiteSubscriptionLegacy: 'pending_reconciliation' },
        },
      ],
      loadOutcome: 'ok' as const,
    }
    const decision = evaluateIncludedFreeAccessForAccount({
      entitlementKey: 'core.crm',
      customerAccountId: ACCOUNT_A,
      evidence,
    })
    expect(decision.allowed).toBe(false)
    if (!decision.allowed) expect(decision.code).toBe('LEGACY_EVIDENCE_AMBIGUOUS')
  })

  it('fails closed when subscription evidence load fails', () => {
    const evidence = {
      ...emptySubscriberEvidence(ACCOUNT_A),
      loadOutcome: 'failed' as const,
      loadError: 'connection reset',
    }
    const decision = evaluateIncludedFreeAccessForAccount({
      entitlementKey: 'core.crm',
      customerAccountId: ACCOUNT_A,
      evidence,
    })
    expect(decision.allowed).toBe(false)
    if (!decision.allowed) expect(decision.code).toBe('SUBSCRIPTION_EVIDENCE_UNAVAILABLE')
  })

  it('supports future ALL_SIGNUPS cohort when explicitly configured', () => {
    vi.stubEnv('OPEN001_FREE_SOFTWARE_COHORT', 'ALL_SIGNUPS')
    const evidence = emptySubscriberEvidence(ACCOUNT_B)
    expect(resolveSubscriberEligibility(ACCOUNT_B, evidence, 'ALL_SIGNUPS').outcome).toBe('QUALIFIED')
  })
})

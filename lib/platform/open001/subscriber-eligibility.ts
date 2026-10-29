import type { FreeServiceEligibilityCohort } from '@/lib/marketplace/catalog'
import { getOpen001FreeSoftwareCohort } from '@/lib/platform/open001/policy'
import {
  LEGACY_WEBSITE_SUBSCRIBER_SERVICE_KEY,
  WEBSITE_SUBSCRIPTION_PRODUCT_KEY,
  type SubscriberEvidenceSnapshot,
  type WebsiteSubscriptionEvidenceRow,
} from '@/lib/platform/open001/subscriber-evidence'
import type { SubscriptionStatus } from '@/lib/platform/commerce/types'

export type SubscriberEligibilityOutcome =
  | 'QUALIFIED'
  | 'NOT_ELIGIBLE'
  | 'EVIDENCE_UNVERIFIABLE'
  | 'LEGACY_EVIDENCE_AMBIGUOUS'

export type SubscriberEligibilityResult = {
  outcome: SubscriberEligibilityOutcome
  cohort: FreeServiceEligibilityCohort
  /** Stable, non-leaking reason for logs and API messages. */
  reasonCode: string
}

const QUALIFYING_SUBSCRIPTION_STATUSES: ReadonlySet<SubscriptionStatus> = new Set([
  'ACTIVE',
  'PAST_DUE',
  'CANCEL_SCHEDULED',
])

function subscriptionQualifies(row: WebsiteSubscriptionEvidenceRow, customerAccountId: string): boolean {
  if (row.customerAccountId !== customerAccountId) return false
  if (row.productKey !== WEBSITE_SUBSCRIPTION_PRODUCT_KEY) return false
  return QUALIFYING_SUBSCRIPTION_STATUSES.has(row.status)
}

function legacyServiceQualifies(
  snapshot: SubscriberEvidenceSnapshot,
  customerAccountId: string,
): boolean {
  return snapshot.legacyWebsiteServices.some(
    (row) =>
      row.customerAccountId === customerAccountId &&
      row.serviceKey === LEGACY_WEBSITE_SUBSCRIBER_SERVICE_KEY &&
      row.status === 'ACTIVE',
  )
}

function detectAmbiguousLegacyEvidence(snapshot: SubscriberEvidenceSnapshot): boolean {
  return snapshot.legacyWebsiteServices.some((row) => {
    if (row.customerAccountId !== snapshot.customerAccountId) return false
    if (row.serviceKey === LEGACY_WEBSITE_SUBSCRIBER_SERVICE_KEY) return false
    if (row.status !== 'ACTIVE' && row.status !== 'PENDING') return false
    const meta = row.metadata
    if (meta && typeof meta === 'object' && meta !== null) {
      const tag = (meta as { websiteSubscriptionLegacy?: unknown }).websiteSubscriptionLegacy
      if (tag === true || tag === 'pending_reconciliation') return true
    }
    return false
  })
}

/**
 * Account-scoped resolver for OPEN-001 included FREE software.
 * Membership alone never qualifies under SUBSCRIBER_ONLY.
 */
export function resolveSubscriberEligibility(
  customerAccountId: string,
  evidence: SubscriberEvidenceSnapshot,
  cohort: FreeServiceEligibilityCohort = getOpen001FreeSoftwareCohort(),
): SubscriberEligibilityResult {
  if (cohort === 'UNRESOLVED') {
    return {
      outcome: 'EVIDENCE_UNVERIFIABLE',
      cohort,
      reasonCode: 'OPEN001_COHORT_UNRESOLVED',
    }
  }

  if (evidence.loadOutcome === 'failed') {
    return {
      outcome: 'EVIDENCE_UNVERIFIABLE',
      cohort,
      reasonCode: 'SUBSCRIPTION_EVIDENCE_LOAD_FAILED',
    }
  }

  if (cohort === 'ALL_SIGNUPS') {
    return { outcome: 'QUALIFIED', cohort, reasonCode: 'ALL_SIGNUPS_COHORT' }
  }

  if (cohort === 'HYBRID') {
    // Retained for future owner configuration — inactive; behaves as SUBSCRIBER_ONLY until authorized.
    cohort = 'SUBSCRIBER_ONLY'
  }

  const hasQualifyingSubscription = evidence.subscriptions.some((row) =>
    subscriptionQualifies(row, customerAccountId),
  )
  if (hasQualifyingSubscription) {
    return { outcome: 'QUALIFIED', cohort: 'SUBSCRIBER_ONLY', reasonCode: 'WEBSITE_SUBSCRIPTION_ACTIVE' }
  }

  if (legacyServiceQualifies(evidence, customerAccountId)) {
    return { outcome: 'QUALIFIED', cohort: 'SUBSCRIBER_ONLY', reasonCode: 'LEGACY_WEBSITE_SERVICE_ACTIVE' }
  }

  if (detectAmbiguousLegacyEvidence(evidence)) {
    return {
      outcome: 'LEGACY_EVIDENCE_AMBIGUOUS',
      cohort: 'SUBSCRIBER_ONLY',
      reasonCode: 'LEGACY_WEBSITE_EVIDENCE_AMBIGUOUS',
    }
  }

  const hasDisqualifyingSubscription = evidence.subscriptions.some(
    (row) =>
      row.customerAccountId === customerAccountId &&
      row.productKey === WEBSITE_SUBSCRIPTION_PRODUCT_KEY &&
      !QUALIFYING_SUBSCRIPTION_STATUSES.has(row.status),
  )
  if (hasDisqualifyingSubscription) {
    return { outcome: 'NOT_ELIGIBLE', cohort: 'SUBSCRIBER_ONLY', reasonCode: 'WEBSITE_SUBSCRIPTION_INACTIVE' }
  }

  return { outcome: 'NOT_ELIGIBLE', cohort: 'SUBSCRIBER_ONLY', reasonCode: 'NO_QUALIFYING_WEBSITE_SUBSCRIPTION' }
}

export function subscriberEligibilityGrantsIncludedFree(result: SubscriberEligibilityResult): boolean {
  return result.outcome === 'QUALIFIED'
}

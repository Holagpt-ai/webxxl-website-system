import type { FreeServiceEligibilityCohort } from '@/lib/marketplace/catalog'

/** Canonical owner decision recorded 2026-10-29 (OPEN-001). */
export const OPEN001_DECISION_ID = 'OPEN-001' as const

export const OPEN001_POLICY_VERSION = '2026-10-29.1' as const

export type Open001DecisionStatus = 'RESOLVED_OWNER_APPROVED'

export const OPEN001_DECISION: {
  id: typeof OPEN001_DECISION_ID
  status: Open001DecisionStatus
  resolvedAt: string
  activeCohort: FreeServiceEligibilityCohort
  inactiveFutureCohorts: FreeServiceEligibilityCohort[]
} = {
  id: OPEN001_DECISION_ID,
  status: 'RESOLVED_OWNER_APPROVED',
  resolvedAt: '2026-10-29',
  activeCohort: 'SUBSCRIBER_ONLY',
  inactiveFutureCohorts: ['ALL_SIGNUPS', 'HYBRID'],
}

const ALLOWED_COHORTS: FreeServiceEligibilityCohort[] = [
  'SUBSCRIBER_ONLY',
  'ALL_SIGNUPS',
  'HYBRID',
  'UNRESOLVED',
]

/**
 * Active FREE software eligibility cohort. Defaults to owner-approved SUBSCRIBER_ONLY.
 * Future cohort switches require explicit owner authorization and a policy version bump.
 */
export function getOpen001FreeSoftwareCohort(): FreeServiceEligibilityCohort {
  const raw = process.env.OPEN001_FREE_SOFTWARE_COHORT?.trim()
  if (raw && ALLOWED_COHORTS.includes(raw as FreeServiceEligibilityCohort)) {
    return raw as FreeServiceEligibilityCohort
  }
  return OPEN001_DECISION.activeCohort
}

export function isOpen001PolicyResolved(): boolean {
  return getOpen001FreeSoftwareCohort() !== 'UNRESOLVED'
}

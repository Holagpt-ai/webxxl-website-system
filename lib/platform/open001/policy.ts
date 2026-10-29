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
 * Owner-approved cohorts per policy version. Future cohort activation requires a new
 * version entry in the decision log — not env alone.
 */
export const OPEN001_AUTHORIZED_COHORTS_BY_POLICY_VERSION: Readonly<
  Record<string, readonly FreeServiceEligibilityCohort[]>
> = {
  [OPEN001_POLICY_VERSION]: ['SUBSCRIBER_ONLY'],
}

function cohortAuthorizedForPolicyVersion(
  cohort: FreeServiceEligibilityCohort,
  policyVersion: string,
): boolean {
  const authorized =
    OPEN001_AUTHORIZED_COHORTS_BY_POLICY_VERSION[policyVersion] ??
    OPEN001_AUTHORIZED_COHORTS_BY_POLICY_VERSION[OPEN001_POLICY_VERSION]
  return authorized?.includes(cohort) ?? false
}

/**
 * Active FREE software eligibility cohort. Defaults to owner-approved SUBSCRIBER_ONLY.
 * Inactive cohorts (ALL_SIGNUPS, HYBRID) cannot activate from env without a policy version
 * that explicitly authorizes them in OPEN001_AUTHORIZED_COHORTS_BY_POLICY_VERSION.
 */
export function getOpen001FreeSoftwareCohort(): FreeServiceEligibilityCohort {
  const rawCohort = process.env.OPEN001_FREE_SOFTWARE_COHORT?.trim()
  if (!rawCohort || !ALLOWED_COHORTS.includes(rawCohort as FreeServiceEligibilityCohort)) {
    return OPEN001_DECISION.activeCohort
  }

  const requested = rawCohort as FreeServiceEligibilityCohort
  if (requested === OPEN001_DECISION.activeCohort) {
    return OPEN001_DECISION.activeCohort
  }

  const envVersion = process.env.OPEN001_POLICY_VERSION?.trim()
  const policyVersion =
    envVersion && envVersion in OPEN001_AUTHORIZED_COHORTS_BY_POLICY_VERSION
      ? envVersion
      : OPEN001_POLICY_VERSION

  if (cohortAuthorizedForPolicyVersion(requested, policyVersion)) {
    return requested
  }

  return OPEN001_DECISION.activeCohort
}

/** True when env requests a cohort not authorized for the effective policy version. */
export function isUnauthorizedOpen001CohortEnvironmentOverride(): boolean {
  const rawCohort = process.env.OPEN001_FREE_SOFTWARE_COHORT?.trim()
  if (!rawCohort || !ALLOWED_COHORTS.includes(rawCohort as FreeServiceEligibilityCohort)) {
    return false
  }
  const requested = rawCohort as FreeServiceEligibilityCohort
  if (requested === OPEN001_DECISION.activeCohort) return false

  const envVersion = process.env.OPEN001_POLICY_VERSION?.trim()
  const policyVersion =
    envVersion && envVersion in OPEN001_AUTHORIZED_COHORTS_BY_POLICY_VERSION
      ? envVersion
      : OPEN001_POLICY_VERSION

  return !cohortAuthorizedForPolicyVersion(requested, policyVersion)
}

export function isOpen001PolicyResolved(): boolean {
  return getOpen001FreeSoftwareCohort() !== 'UNRESOLVED'
}

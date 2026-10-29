import type { EntitlementAccessState } from '@/lib/platform/entitlements'
import { evaluateEntitlementAccess, getServiceEntitlement } from '@/lib/platform/entitlements'
import { getOpen001FreeSoftwareCohort } from '@/lib/platform/open001/policy'
import { loadSubscriberEvidenceForAccount } from '@/lib/platform/open001/load-subscriber-evidence'
import {
  resolveSubscriberEligibility,
  subscriberEligibilityGrantsIncludedFree,
} from '@/lib/platform/open001/subscriber-eligibility'
import type { SubscriberEvidenceSnapshot } from '@/lib/platform/open001/subscriber-evidence'

export type IncludedFreeAccessDecision =
  | { allowed: true; access: 'INCLUDED' }
  | {
      allowed: false
      access: EntitlementAccessState | 'NOT_ELIGIBLE' | 'EVIDENCE_UNVERIFIABLE' | 'LEGACY_EVIDENCE_AMBIGUOUS'
      httpStatus: number
      code: string
      message: string
    }

const STABLE_MESSAGES = {
  POLICY_UNRESOLVED:
    'Included business software eligibility policy is not configured (OPEN-001).',
  NOT_ELIGIBLE:
    'Included business software requires an active website subscription for this customer account.',
  EVIDENCE_UNVERIFIABLE:
    'Website subscription eligibility cannot be verified for this account.',
  LEGACY_EVIDENCE_AMBIGUOUS:
    'Legacy website subscription evidence requires owner reconciliation before access is granted.',
  DISABLED: 'This software module is disabled in the current environment.',
} as const

export function evaluateIncludedFreeAccessForAccount(input: {
  entitlementKey: string
  customerAccountId: string
  evidence: SubscriberEvidenceSnapshot
}): IncludedFreeAccessDecision {
  const entitlement = getServiceEntitlement(input.entitlementKey)
  if (!entitlement) {
    return {
      allowed: false,
      access: 'POLICY_UNRESOLVED',
      httpStatus: 503,
      code: 'POLICY_UNRESOLVED',
      message: STABLE_MESSAGES.POLICY_UNRESOLVED,
    }
  }

  const cohort = getOpen001FreeSoftwareCohort()
  const policy = evaluateEntitlementAccess(entitlement, { configuredCohort: cohort })
  if (policy.access === 'DISABLED') {
    return {
      allowed: false,
      access: 'DISABLED',
      httpStatus: 403,
      code: 'FORBIDDEN',
      message: STABLE_MESSAGES.DISABLED,
    }
  }
  if (policy.access === 'POLICY_UNRESOLVED') {
    return {
      allowed: false,
      access: 'POLICY_UNRESOLVED',
      httpStatus: 503,
      code: 'POLICY_UNRESOLVED',
      message: STABLE_MESSAGES.POLICY_UNRESOLVED,
    }
  }

  const subscriber = resolveSubscriberEligibility(input.customerAccountId, input.evidence, cohort)
  if (subscriberEligibilityGrantsIncludedFree(subscriber)) {
    return { allowed: true, access: 'INCLUDED' }
  }

  switch (subscriber.outcome) {
    case 'NOT_ELIGIBLE':
      return {
        allowed: false,
        access: 'NOT_ELIGIBLE',
        httpStatus: 403,
        code: 'FREE_SOFTWARE_NOT_ELIGIBLE',
        message: STABLE_MESSAGES.NOT_ELIGIBLE,
      }
    case 'EVIDENCE_UNVERIFIABLE':
      return {
        allowed: false,
        access: 'EVIDENCE_UNVERIFIABLE',
        httpStatus: 503,
        code: 'SUBSCRIPTION_EVIDENCE_UNAVAILABLE',
        message: STABLE_MESSAGES.EVIDENCE_UNVERIFIABLE,
      }
    case 'LEGACY_EVIDENCE_AMBIGUOUS':
      return {
        allowed: false,
        access: 'LEGACY_EVIDENCE_AMBIGUOUS',
        httpStatus: 503,
        code: 'LEGACY_EVIDENCE_AMBIGUOUS',
        message: STABLE_MESSAGES.LEGACY_EVIDENCE_AMBIGUOUS,
      }
    default:
      return {
        allowed: false,
        access: 'NOT_ELIGIBLE',
        httpStatus: 403,
        code: 'FREE_SOFTWARE_NOT_ELIGIBLE',
        message: STABLE_MESSAGES.NOT_ELIGIBLE,
      }
  }
}

export async function evaluateIncludedFreeAccessForAccountFromDatabase(input: {
  entitlementKey: string
  customerAccountId: string
}): Promise<IncludedFreeAccessDecision> {
  const evidence = await loadSubscriberEvidenceForAccount(input.customerAccountId)
  return evaluateIncludedFreeAccessForAccount({
    entitlementKey: input.entitlementKey,
    customerAccountId: input.customerAccountId,
    evidence,
  })
}

export function throwIncludedFreeAccessDecision(
  decision: IncludedFreeAccessDecision,
  ApiError: new (status: number, message: string, code: string) => Error,
): void {
  if (decision.allowed) return
  throw new ApiError(decision.httpStatus, decision.message, decision.code)
}

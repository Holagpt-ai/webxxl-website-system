import { requireCustomerMembership } from '@/lib/portal/authz'
import {
  evaluateIncludedFreeAccessForAccount,
  throwIncludedFreeAccessDecision,
} from '@/lib/platform/open001/included-free-access'
import { loadSubscriberEvidenceForAccount } from '@/lib/platform/open001/load-subscriber-evidence'

type PortalMembership = Awaited<ReturnType<typeof requireCustomerMembership>>

/** Shared OPEN-001 gate after backend flag checks — requires authenticated CustomerAccount context. */
export async function requireIncludedFreeSoftwareMembership(
  entitlementKey: string,
  ApiError: new (status: number, message: string, code: string) => Error,
): Promise<PortalMembership> {
  return requireIncludedFreeSoftwareMembershipKeys([entitlementKey], ApiError)
}

/** Evaluate multiple included-free entitlements with one membership + evidence load. */
export async function requireIncludedFreeSoftwareMembershipKeys(
  entitlementKeys: readonly string[],
  ApiError: new (status: number, message: string, code: string) => Error,
): Promise<PortalMembership> {
  const portal = await requireCustomerMembership()
  const evidence = await loadSubscriberEvidenceForAccount(portal.customerAccount.id)
  for (const entitlementKey of entitlementKeys) {
    const decision = evaluateIncludedFreeAccessForAccount({
      entitlementKey,
      customerAccountId: portal.customerAccount.id,
      evidence,
    })
    throwIncludedFreeAccessDecision(decision, ApiError)
  }
  return portal
}

/** Marketing Studio + Postiz social automation entitlements for Social HTTP APIs. */
export const SOCIAL_INCLUDED_FREE_ENTITLEMENT_KEYS = [
  'core.social-automation',
  'core.marketing-studio',
] as const

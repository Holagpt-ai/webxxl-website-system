import { requireCustomerMembership } from '@/lib/portal/authz'
import {
  evaluateIncludedFreeAccessForAccountFromDatabase,
  throwIncludedFreeAccessDecision,
} from '@/lib/platform/open001/included-free-access'

type PortalMembership = Awaited<ReturnType<typeof requireCustomerMembership>>

/** Shared OPEN-001 gate after backend flag checks — requires authenticated CustomerAccount context. */
export async function requireIncludedFreeSoftwareMembership(
  entitlementKey: string,
  ApiError: new (status: number, message: string, code: string) => Error,
): Promise<PortalMembership> {
  const portal = await requireCustomerMembership()
  const decision = await evaluateIncludedFreeAccessForAccountFromDatabase({
    entitlementKey,
    customerAccountId: portal.customerAccount.id,
  })
  throwIncludedFreeAccessDecision(decision, ApiError)
  return portal
}

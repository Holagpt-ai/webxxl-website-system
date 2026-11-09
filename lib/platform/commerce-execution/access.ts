import { isCommerceBackendEnabled } from '@/config/commerce-backend'
import { isStaffRole } from '@/lib/admin/roles'
import type { PortalUser } from '@/lib/portal/authz'
import type { BusinessModuleReadiness } from '@/lib/platform/business-overview/types'
import { loadSubscriberEvidenceForAccount } from '@/lib/platform/open001/load-subscriber-evidence'
import {
  evaluateIncludedFreeAccessForAccount,
} from '@/lib/platform/open001/included-free-access'

export type CommerceExecutionContext = {
  portal: PortalUser
  evidence: Awaited<ReturnType<typeof loadSubscriberEvidenceForAccount>>
  isStaff: boolean
}

export async function loadCommerceExecutionContext(portal: PortalUser): Promise<CommerceExecutionContext> {
  const evidence = await loadSubscriberEvidenceForAccount(portal.customerAccount.id)
  return { portal, evidence, isStaff: isStaffRole(portal.role) }
}

export function resolveCommerceExecutionCoreAccess(
  ctx: CommerceExecutionContext,
): BusinessModuleReadiness | 'proceed' {
  if (!isCommerceBackendEnabled()) {
    return { state: 'disabled', reasonCode: 'COMMERCE_DISABLED', message: 'Commerce backend is disabled' }
  }
  // Purchases remain SUBSCRIBER_ONLY at catalog gates; summary read requires membership only.
  if (!ctx.portal.customerAccount?.id) {
    return { state: 'unauthorized', reasonCode: 'FORBIDDEN', message: 'Customer account membership required' }
  }
  return 'proceed'
}

/** Included FREE software stays entitlement-gated and non-purchasable. */
export function assertIncludedFreeRemainsNonPayable(entitlementKey: string, ctx: CommerceExecutionContext) {
  return evaluateIncludedFreeAccessForAccount({
    entitlementKey,
    customerAccountId: ctx.portal.customerAccount.id,
    evidence: ctx.evidence,
  })
}

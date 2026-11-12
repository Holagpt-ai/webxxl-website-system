import { isStaffRole } from '@/lib/admin/roles'
import type { PortalUser } from '@/lib/portal/authz'
import { AiWorkforceApiError } from '@/lib/platform/ai-workforce-execution/ai-workforce-api-error'
import {
  CRM_AUDIENCE_PLANNING_INCLUDED_FREE_ENTITLEMENT_KEYS,
  requireIncludedFreeSoftwareMembershipKeys,
} from '@/lib/platform/open001/module-api-gate'

/** OPEN-001 subscriber cohort for included marketing / CRM workforce preparation. */
export const AI_WORKFORCE_INCLUDED_FREE_ENTITLEMENT_KEYS = CRM_AUDIENCE_PLANNING_INCLUDED_FREE_ENTITLEMENT_KEYS

export async function requireAiWorkforceSubscriberPortal(): Promise<PortalUser> {
  return requireIncludedFreeSoftwareMembershipKeys(AI_WORKFORCE_INCLUDED_FREE_ENTITLEMENT_KEYS, AiWorkforceApiError)
}

export function assertTrustedAiWorkforceStaffOperator(portal: PortalUser): void {
  if (!isStaffRole(portal.role)) {
    throw new AiWorkforceApiError(403, 'Staff operator role required', 'FORBIDDEN')
  }
}

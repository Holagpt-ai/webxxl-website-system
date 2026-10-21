import { isEnabled } from '@/config/features'
import { isAnalyticsBackendEnabled } from '@/config/analytics-backend'
import { evaluateEntitlementAccess, getServiceEntitlement } from '@/lib/platform/entitlements'
import { isStaffRole } from '@/lib/admin/roles'
import { requireCustomerMembership } from '@/lib/portal/authz'
import type { AnalyticsError } from '@/lib/platform/analytics/types'

export class AnalyticsApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code: AnalyticsError | 'INTERNAL',
  ) {
    super(message)
  }
}

export async function requireAnalyticsApiActor() {
  if (!isAnalyticsBackendEnabled() || !isEnabled('analyticsBackend')) {
    throw new AnalyticsApiError(503, 'Analytics backend is disabled', 'ANALYTICS_DISABLED')
  }
  const entitlement = getServiceEntitlement('core.analytics')
  if (!entitlement) throw new AnalyticsApiError(503, 'Analytics entitlement missing', 'ENTITLEMENT_UNRESOLVED')
  const access = evaluateEntitlementAccess(entitlement)
  if (access.access === 'DISABLED') {
    throw new AnalyticsApiError(403, 'Analytics entitlement disabled', 'FORBIDDEN')
  }
  if (access.access === 'POLICY_UNRESOLVED') {
    throw new AnalyticsApiError(503, 'Analytics FREE eligibility unresolved', 'ENTITLEMENT_UNRESOLVED')
  }
  const portal = await requireCustomerMembership()
  return {
    userId: portal.id,
    customerAccountId: portal.customerAccount.id,
    isStaff: isStaffRole(portal.role),
    membershipRole: portal.membership.role,
  }
}

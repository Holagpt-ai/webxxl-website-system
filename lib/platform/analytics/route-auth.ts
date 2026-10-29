import { isEnabled } from '@/config/features'
import { isAnalyticsBackendEnabled } from '@/config/analytics-backend'
import { isStaffRole } from '@/lib/admin/roles'
import { requireIncludedFreeSoftwareMembership } from '@/lib/platform/open001/module-api-gate'
import type { AnalyticsError } from '@/lib/platform/analytics/types'

export class AnalyticsApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code: AnalyticsError | 'INTERNAL' | string,
  ) {
    super(message)
  }
}

export async function requireAnalyticsApiActor() {
  if (!isAnalyticsBackendEnabled() || !isEnabled('analyticsBackend')) {
    throw new AnalyticsApiError(503, 'Analytics backend is disabled', 'ANALYTICS_DISABLED')
  }
  const portal = await requireIncludedFreeSoftwareMembership('core.analytics', AnalyticsApiError)
  return {
    userId: portal.id,
    customerAccountId: portal.customerAccount.id,
    isStaff: isStaffRole(portal.role),
    membershipRole: portal.membership.role,
  }
}

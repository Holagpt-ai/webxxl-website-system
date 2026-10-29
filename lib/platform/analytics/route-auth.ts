import { isEnabled } from '@/config/features'
import { isAnalyticsBackendEnabled } from '@/config/analytics-backend'
import { isStaffRole } from '@/lib/admin/roles'
import { requireIncludedFreeSoftwareMembership } from '@/lib/platform/open001/module-api-gate'
import type { AnalyticsError } from '@/lib/platform/analytics/types'

export function analyticsErrorFromApiCode(code: string): AnalyticsError {
  if (code === 'INTERNAL') return 'UNKNOWN'
  if (code === 'FREE_SOFTWARE_NOT_ELIGIBLE') return 'FORBIDDEN'
  if (
    code === 'SUBSCRIPTION_EVIDENCE_UNAVAILABLE' ||
    code === 'LEGACY_EVIDENCE_AMBIGUOUS' ||
    code === 'POLICY_UNRESOLVED'
  ) {
    return 'ENTITLEMENT_UNRESOLVED'
  }
  const known: AnalyticsError[] = [
    'ANALYTICS_DISABLED',
    'UNAUTHORIZED',
    'FORBIDDEN',
    'TENANT_MISMATCH',
    'VALIDATION',
    'ENTITLEMENT_UNRESOLVED',
    'NOT_FOUND',
    'PROVIDER_UNAVAILABLE',
    'UNKNOWN',
  ]
  return known.includes(code as AnalyticsError) ? (code as AnalyticsError) : 'UNKNOWN'
}

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

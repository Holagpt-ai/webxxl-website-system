import { isSeoBackendEnabled } from '@/config/seo-backend'
import { evaluateEntitlementAccess, getServiceEntitlement } from '@/lib/platform/entitlements'
import { isStaffRole } from '@/lib/admin/roles'
import { requireCustomerMembership } from '@/lib/portal/authz'
import { assertSeoPermission, type SeoPermission } from '@/lib/platform/seo/permissions'
import { SeoApiError } from '@/lib/platform/seo/seo-api-error'

export { SeoApiError }

export async function requireSeoApiActor(requiredPermission: SeoPermission = 'seo.read') {
  if (!isSeoBackendEnabled()) {
    throw new SeoApiError(503, 'SEO backend is disabled', 'SEO_DISABLED')
  }
  const entitlement = getServiceEntitlement('core.local-seo')
  if (!entitlement) throw new SeoApiError(503, 'Local SEO entitlement missing', 'POLICY_UNRESOLVED')
  const access = evaluateEntitlementAccess(entitlement)
  if (access.access === 'DISABLED') {
    throw new SeoApiError(403, 'Local SEO entitlement disabled', 'FORBIDDEN')
  }
  if (access.access === 'POLICY_UNRESOLVED') {
    throw new SeoApiError(503, 'Local SEO FREE eligibility unresolved (OPEN-001)', 'POLICY_UNRESOLVED')
  }
  const portal = await requireCustomerMembership()
  const permissionActor = {
    membershipRole: portal.membership.role,
    isStaff: isStaffRole(portal.role),
  }
  try {
    assertSeoPermission(permissionActor, requiredPermission)
  } catch {
    throw new SeoApiError(403, 'Insufficient SEO permission', 'FORBIDDEN')
  }
  return {
    userId: portal.id,
    customerAccountId: portal.customerAccount.id,
    membershipRole: portal.membership.role,
    isStaff: permissionActor.isStaff,
  }
}

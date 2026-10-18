import { isMktBackendEnabled } from '@/config/mkt-backend'
import { evaluateEntitlementAccess, getServiceEntitlement } from '@/lib/platform/entitlements'
import { isStaffRole } from '@/lib/admin/roles'
import { requireCustomerMembership } from '@/lib/portal/authz'
import { assertMarketingPermission, type MarketingPermission } from '@/lib/platform/marketing/permissions'
import { MktApiError } from '@/lib/platform/marketing/mkt-api-error'

export { MktApiError }

export async function requireMktApiActor(requiredPermission: MarketingPermission = 'marketing.read') {
  if (!isMktBackendEnabled()) {
    throw new MktApiError(503, 'Marketing backend is disabled', 'MKT_DISABLED')
  }
  const entitlement = getServiceEntitlement('core.marketing-studio')
  if (!entitlement) throw new MktApiError(503, 'Marketing Studio entitlement missing', 'POLICY_UNRESOLVED')
  const access = evaluateEntitlementAccess(entitlement)
  if (access.access === 'DISABLED') throw new MktApiError(403, 'Marketing entitlement disabled', 'FORBIDDEN')
  if (access.access === 'POLICY_UNRESOLVED') {
    throw new MktApiError(503, 'Marketing FREE eligibility unresolved (OPEN-001)', 'POLICY_UNRESOLVED')
  }
  const portal = await requireCustomerMembership()
  const actor = { membershipRole: portal.membership.role, isStaff: isStaffRole(portal.role) }
  try {
    assertMarketingPermission(actor, requiredPermission)
  } catch {
    throw new MktApiError(403, 'Insufficient marketing permission', 'FORBIDDEN')
  }
  return {
    userId: portal.id,
    customerAccountId: portal.customerAccount.id,
    membershipRole: portal.membership.role,
    isStaff: actor.isStaff,
  }
}

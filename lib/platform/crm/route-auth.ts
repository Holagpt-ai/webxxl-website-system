import { isCrmBackendEnabled } from '@/config/crm-backend'
import { evaluateEntitlementAccess, getServiceEntitlement } from '@/lib/platform/entitlements'
import { isStaffRole } from '@/lib/admin/roles'
import { requireCustomerMembership } from '@/lib/portal/authz'
import { assertCrmPermission, type CrmPermission } from '@/lib/platform/crm/permissions'
import { CrmApiError } from '@/lib/platform/crm/crm-api-error'

export { CrmApiError }

export async function requireCrmApiActor(requiredPermission: CrmPermission = 'crm.read') {
  if (!isCrmBackendEnabled()) {
    throw new CrmApiError(503, 'CRM backend is disabled', 'CRM_DISABLED')
  }
  const entitlement = getServiceEntitlement('core.crm')
  if (!entitlement) throw new CrmApiError(503, 'CRM entitlement missing', 'POLICY_UNRESOLVED')
  const access = evaluateEntitlementAccess(entitlement)
  if (access.access === 'DISABLED') {
    throw new CrmApiError(403, 'CRM entitlement disabled', 'FORBIDDEN')
  }
  if (access.access === 'POLICY_UNRESOLVED') {
    throw new CrmApiError(503, 'CRM FREE eligibility unresolved (OPEN-001)', 'POLICY_UNRESOLVED')
  }
  const portal = await requireCustomerMembership()
  const permissionActor = {
    membershipRole: portal.membership.role,
    isStaff: isStaffRole(portal.role),
  }
  assertCrmPermission(permissionActor, requiredPermission)
  return {
    userId: portal.id,
    customerAccountId: portal.customerAccount.id,
    membershipRole: portal.membership.role,
    entitlementAccess: access.access,
    isStaff: permissionActor.isStaff,
  }
}

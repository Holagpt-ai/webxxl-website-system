import { isCommsBackendEnabled } from '@/config/comms-backend'
import { evaluateEntitlementAccess, getServiceEntitlement } from '@/lib/platform/entitlements'
import { isStaffRole } from '@/lib/admin/roles'
import { requireCustomerMembership } from '@/lib/portal/authz'
import { assertCommsPermission, type CommsPermission } from '@/lib/platform/comms/permissions'
import { CommsApiError } from '@/lib/platform/comms/comms-api-error'

export { CommsApiError }

export async function requireCommsApiActor(requiredPermission: CommsPermission = 'comms.read') {
  if (!isCommsBackendEnabled()) {
    throw new CommsApiError(503, 'Communications backend is disabled', 'COMMS_DISABLED')
  }
  const entitlement = getServiceEntitlement('core.communications')
  if (!entitlement) throw new CommsApiError(503, 'Communications entitlement missing', 'POLICY_UNRESOLVED')
  const access = evaluateEntitlementAccess(entitlement)
  if (access.access === 'DISABLED') {
    throw new CommsApiError(403, 'Communications entitlement disabled', 'FORBIDDEN')
  }
  if (access.access === 'POLICY_UNRESOLVED') {
    throw new CommsApiError(503, 'Communications FREE eligibility unresolved (OPEN-001)', 'POLICY_UNRESOLVED')
  }
  const portal = await requireCustomerMembership()
  const permissionActor = {
    membershipRole: portal.membership.role,
    isStaff: isStaffRole(portal.role),
  }
  assertCommsPermission(permissionActor, requiredPermission)
  return {
    userId: portal.id,
    customerAccountId: portal.customerAccount.id,
    membershipRole: portal.membership.role,
    isStaff: permissionActor.isStaff,
  }
}

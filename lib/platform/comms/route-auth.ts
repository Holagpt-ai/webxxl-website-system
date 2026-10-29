import { isCommsBackendEnabled } from '@/config/comms-backend'
import { isStaffRole } from '@/lib/admin/roles'
import { assertCommsPermission, type CommsPermission } from '@/lib/platform/comms/permissions'
import { CommsApiError } from '@/lib/platform/comms/comms-api-error'
import { requireIncludedFreeSoftwareMembership } from '@/lib/platform/open001/module-api-gate'

export { CommsApiError }

export async function requireCommsApiActor(requiredPermission: CommsPermission = 'comms.read') {
  if (!isCommsBackendEnabled()) {
    throw new CommsApiError(503, 'Communications backend is disabled', 'COMMS_DISABLED')
  }
  const portal = await requireIncludedFreeSoftwareMembership('core.communications', CommsApiError)
  const actor = { membershipRole: portal.membership.role, isStaff: isStaffRole(portal.role) }
  assertCommsPermission(actor, requiredPermission)
  return {
    userId: portal.id,
    customerAccountId: portal.customerAccount.id,
    membershipRole: portal.membership.role,
    isStaff: actor.isStaff,
  }
}

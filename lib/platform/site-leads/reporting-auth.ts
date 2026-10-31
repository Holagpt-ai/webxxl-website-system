import { isCrmBackendEnabled } from '@/config/crm-backend'
import { isStaffRole } from '@/lib/admin/roles'
import { assertCrmPermission } from '@/lib/platform/crm/permissions'
import { CrmApiError } from '@/lib/platform/crm/crm-api-error'
import { requireIncludedFreeSoftwareMembership } from '@/lib/platform/open001/module-api-gate'

export { CrmApiError as SiteLeadReportingApiError }

/** Read-only lead funnel reporting — does not require live intake activation. */
export async function requireSiteLeadReportingActor(requiredPermission: 'crm.read' = 'crm.read') {
  if (!isCrmBackendEnabled()) {
    throw new CrmApiError(503, 'CRM backend is disabled', 'CRM_DISABLED')
  }
  const portal = await requireIncludedFreeSoftwareMembership('core.crm', CrmApiError)
  const permissionActor = {
    membershipRole: portal.membership.role,
    isStaff: isStaffRole(portal.role),
  }
  assertCrmPermission(permissionActor, requiredPermission)
  return {
    userId: portal.id,
    customerAccountId: portal.customerAccount.id,
    membershipRole: portal.membership.role,
    isStaff: permissionActor.isStaff,
  }
}

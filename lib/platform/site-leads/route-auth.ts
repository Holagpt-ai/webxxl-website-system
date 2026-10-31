import { isCrmBackendEnabled } from '@/config/crm-backend'
import { isSiteLeadIntakeEnabled } from '@/config/site-lead-intake'
import { isStaffRole } from '@/lib/admin/roles'
import { assertCrmPermission, type CrmPermission } from '@/lib/platform/crm/permissions'
import { CrmApiError } from '@/lib/platform/crm/crm-api-error'
import { requireIncludedFreeSoftwareMembership } from '@/lib/platform/open001/module-api-gate'

export { CrmApiError as SiteLeadApiError }

export async function requireSiteLeadInboxActor(requiredPermission: CrmPermission = 'crm.read') {
  if (!isSiteLeadIntakeEnabled()) {
    throw new CrmApiError(503, 'Managed-site lead intake is disabled', 'SITE_LEAD_INTAKE_DISABLED')
  }
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

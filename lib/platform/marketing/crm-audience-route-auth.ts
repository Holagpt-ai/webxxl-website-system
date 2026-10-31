import { isCrmBackendEnabled } from '@/config/crm-backend'
import { isMktBackendEnabled, isMktCrmAudiencePlanningEnabled } from '@/config/mkt-backend'
import { isStaffRole } from '@/lib/admin/roles'
import { assertCrmPermission } from '@/lib/platform/crm/permissions'
import { assertMarketingPermission, type MarketingPermission } from '@/lib/platform/marketing/permissions'
import { MktApiError } from '@/lib/platform/marketing/mkt-api-error'
import { requireIncludedFreeSoftwareMembership } from '@/lib/platform/open001/module-api-gate'

export async function requireMktCrmAudienceActor(requiredPermission: MarketingPermission = 'marketing.read') {
  if (!isMktBackendEnabled()) {
    throw new MktApiError(503, 'Marketing backend is disabled', 'MKT_DISABLED')
  }
  if (!isMktCrmAudiencePlanningEnabled()) {
    throw new MktApiError(503, 'CRM audience planning is disabled', 'NOT_CONFIGURED')
  }
  if (!isCrmBackendEnabled()) {
    throw new MktApiError(503, 'CRM backend is disabled', 'NOT_CONFIGURED')
  }
  const portal = await requireIncludedFreeSoftwareMembership('core.marketing-studio', MktApiError)
  const actor = { membershipRole: portal.membership.role, isStaff: isStaffRole(portal.role) }
  try {
    assertMarketingPermission(actor, requiredPermission)
  } catch {
    throw new MktApiError(403, 'Insufficient marketing permission', 'FORBIDDEN')
  }
  try {
    assertCrmPermission(actor, 'crm.read')
  } catch {
    throw new MktApiError(403, 'Insufficient CRM permission', 'FORBIDDEN')
  }
  return {
    userId: portal.id,
    customerAccountId: portal.customerAccount.id,
    membershipRole: portal.membership.role,
    isStaff: actor.isStaff,
  }
}

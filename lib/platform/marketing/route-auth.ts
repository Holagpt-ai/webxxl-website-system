import { isMktBackendEnabled } from '@/config/mkt-backend'
import { isStaffRole } from '@/lib/admin/roles'
import { assertMarketingPermission, type MarketingPermission } from '@/lib/platform/marketing/permissions'
import { MktApiError } from '@/lib/platform/marketing/mkt-api-error'
import { requireIncludedFreeSoftwareMembership } from '@/lib/platform/open001/module-api-gate'

export { MktApiError }

export async function requireMktApiActor(requiredPermission: MarketingPermission = 'marketing.read') {
  if (!isMktBackendEnabled()) {
    throw new MktApiError(503, 'Marketing backend is disabled', 'MKT_DISABLED')
  }
  const portal = await requireIncludedFreeSoftwareMembership('core.marketing-studio', MktApiError)
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

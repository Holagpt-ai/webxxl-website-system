import { isSeoBackendEnabled } from '@/config/seo-backend'
import { isStaffRole } from '@/lib/admin/roles'
import { assertSeoPermission, type SeoPermission } from '@/lib/platform/seo/permissions'
import { SeoApiError } from '@/lib/platform/seo/seo-api-error'
import { requireIncludedFreeSoftwareMembership } from '@/lib/platform/open001/module-api-gate'

export { SeoApiError }

export async function requireSeoApiActor(requiredPermission: SeoPermission = 'seo.read') {
  if (!isSeoBackendEnabled()) {
    throw new SeoApiError(503, 'Local SEO backend is disabled', 'SEO_DISABLED')
  }
  const portal = await requireIncludedFreeSoftwareMembership('core.local-seo', SeoApiError)
  const actor = { membershipRole: portal.membership.role, isStaff: isStaffRole(portal.role) }
  assertSeoPermission(actor, requiredPermission)
  return {
    userId: portal.id,
    customerAccountId: portal.customerAccount.id,
    membershipRole: portal.membership.role,
    isStaff: actor.isStaff,
  }
}

import { isCrmBackendEnabled } from '@/config/crm-backend'
import { evaluateEntitlementAccess, getServiceEntitlement } from '@/lib/platform/entitlements'
import { requireCustomerMembership } from '@/lib/portal/authz'

export class CrmApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = 'FORBIDDEN',
  ) {
    super(message)
    this.name = 'CrmApiError'
  }
}

export async function requireCrmApiActor() {
  if (!isCrmBackendEnabled()) {
    throw new CrmApiError(503, 'CRM backend is disabled', 'CRM_DISABLED')
  }
  const entitlement = getServiceEntitlement('core.crm')
  if (!entitlement) throw new CrmApiError(503, 'CRM entitlement missing', 'POLICY_UNRESOLVED')
  const access = evaluateEntitlementAccess(entitlement)
  if (access.access === 'DISABLED') {
    throw new CrmApiError(403, 'CRM entitlement disabled', 'FORBIDDEN')
  }
  const portal = await requireCustomerMembership()
  return {
    userId: portal.id,
    customerAccountId: portal.customerAccount.id,
    membershipRole: portal.membership.role,
    entitlementAccess: access.access,
  }
}

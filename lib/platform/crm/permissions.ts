import type { MembershipRole } from '@prisma/client'
import { CrmApiError } from '@/lib/platform/crm/crm-api-error'

export type CrmPermission =
  | 'crm.read'
  | 'crm.write'
  | 'crm.import'
  | 'crm.export'
  | 'crm.consent.manage'
  | 'crm.admin'

export type CrmActorPermissions = {
  membershipRole: MembershipRole
  isStaff: boolean
}

export function resolveCrmPermissions(actor: CrmActorPermissions): Set<CrmPermission> {
  const permissions = new Set<CrmPermission>()
  if (actor.isStaff) {
    for (const perm of ['crm.read', 'crm.write', 'crm.import', 'crm.export', 'crm.consent.manage', 'crm.admin'] as const) {
      permissions.add(perm)
    }
    return permissions
  }
  permissions.add('crm.read')
  permissions.add('crm.write')
  if (actor.membershipRole === 'OWNER') {
    permissions.add('crm.import')
    permissions.add('crm.export')
    permissions.add('crm.consent.manage')
    permissions.add('crm.admin')
  }
  return permissions
}

export function assertCrmPermission(actor: CrmActorPermissions, required: CrmPermission): void {
  const granted = resolveCrmPermissions(actor)
  if (!granted.has(required)) {
    throw new CrmApiError(403, `Missing CRM permission: ${required}`, 'FORBIDDEN')
  }
}

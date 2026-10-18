import type { MembershipRole } from '@prisma/client'
import { CommsApiError } from '@/lib/platform/comms/comms-api-error'

export type CommsPermission =
  | 'comms.read'
  | 'comms.write'
  | 'comms.quote'
  | 'comms.intent.prepare'
  | 'comms.admin'
  | 'comms.webhook.manage'

export type CommsActorPermissions = {
  membershipRole: MembershipRole
  isStaff: boolean
}

export function resolveCommsPermissions(actor: CommsActorPermissions): Set<CommsPermission> {
  const permissions = new Set<CommsPermission>()
  if (actor.isStaff) {
    for (const perm of [
      'comms.read',
      'comms.write',
      'comms.quote',
      'comms.intent.prepare',
      'comms.admin',
      'comms.webhook.manage',
    ] as const) {
      permissions.add(perm)
    }
    return permissions
  }
  permissions.add('comms.read')
  permissions.add('comms.quote')
  if (actor.membershipRole === 'OWNER') {
    permissions.add('comms.write')
    permissions.add('comms.intent.prepare')
    permissions.add('comms.admin')
  }
  return permissions
}

export function assertCommsPermission(actor: CommsActorPermissions, required: CommsPermission): void {
  if (!resolveCommsPermissions(actor).has(required)) {
    throw new CommsApiError(403, `Missing communications permission: ${required}`, 'FORBIDDEN')
  }
}

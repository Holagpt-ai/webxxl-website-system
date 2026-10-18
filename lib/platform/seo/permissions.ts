import type { MembershipRole } from '@prisma/client'

export type SeoPermission =
  | 'seo.read'
  | 'seo.configure'
  | 'seo.scan.prepare'
  | 'seo.market.manage'
  | 'seo.opportunity.manage'
  | 'seo.admin'

const ROLE_PERMISSIONS: Record<MembershipRole, SeoPermission[]> = {
  OWNER: ['seo.read', 'seo.configure', 'seo.scan.prepare', 'seo.market.manage', 'seo.opportunity.manage', 'seo.admin'],
  MEMBER: ['seo.read', 'seo.scan.prepare', 'seo.market.manage', 'seo.opportunity.manage'],
}

export function listSeoPermissionsForRole(role: MembershipRole): SeoPermission[] {
  return ROLE_PERMISSIONS[role] ?? ['seo.read']
}

export function assertSeoPermission(
  actor: { membershipRole: MembershipRole; isStaff: boolean },
  required: SeoPermission,
): void {
  if (actor.isStaff && required === 'seo.admin') return
  const allowed = new Set(listSeoPermissionsForRole(actor.membershipRole))
  if (actor.isStaff) allowed.add('seo.read')
  if (!allowed.has(required)) {
    throw new Error(`Missing SEO permission: ${required}`)
  }
}

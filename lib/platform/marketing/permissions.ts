import type { MembershipRole } from '@prisma/client'

export type MarketingPermission =
  | 'marketing.read'
  | 'marketing.request.create'
  | 'marketing.artifact.prepare'
  | 'marketing.artifact.review'
  | 'marketing.brand.manage'
  | 'marketing.followup.read'
  | 'marketing.followup.manage'
  | 'marketing.admin'

const ROLE: Record<MembershipRole, MarketingPermission[]> = {
  OWNER: [
    'marketing.read',
    'marketing.request.create',
    'marketing.artifact.prepare',
    'marketing.artifact.review',
    'marketing.brand.manage',
    'marketing.followup.read',
    'marketing.followup.manage',
    'marketing.admin',
  ],
  MEMBER: [
    'marketing.read',
    'marketing.request.create',
    'marketing.artifact.prepare',
    'marketing.followup.read',
    'marketing.followup.manage',
  ],
}

export function assertMarketingPermission(
  actor: { membershipRole: MembershipRole; isStaff: boolean },
  required: MarketingPermission,
): void {
  if (actor.isStaff && required === 'marketing.admin') return
  const allowed = new Set(ROLE[actor.membershipRole] ?? ['marketing.read'])
  if (actor.isStaff) allowed.add('marketing.read')
  if (!allowed.has(required)) throw new Error(`Missing permission ${required}`)
}

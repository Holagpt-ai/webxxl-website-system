import type { MembershipRole } from '@prisma/client'

export type CustomerAccessLocale = 'en' | 'es'
export type MembershipAccessState = 'ACTIVE' | 'INVITED' | 'PENDING'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeCustomerInviteEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function isValidCustomerInviteEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email)
}

export function isAllowedInviteRole(role: string): role is MembershipRole {
  return role === 'OWNER' || role === 'MEMBER'
}

export function deriveMembershipAccessState(
  user: { emailVerified: Date | null },
  membership: { invitedAt: Date | null; lastInviteSentAt: Date | null },
): MembershipAccessState {
  if (user.emailVerified != null) return 'ACTIVE'
  if (membership.lastInviteSentAt != null || membership.invitedAt != null) return 'INVITED'
  return 'PENDING'
}

export function countOwners(memberships: { role: MembershipRole }[]): number {
  return memberships.filter((m) => m.role === 'OWNER').length
}

/** True when demoting this OWNER would leave the account with zero owners. */
export function wouldViolateLastOwnerOnDemote(
  membership: { id: string; role: MembershipRole },
  allOnAccount: { id: string; role: MembershipRole }[],
  nextRole: MembershipRole,
): boolean {
  if (membership.role !== 'OWNER' || nextRole !== 'MEMBER') return false
  return countOwners(allOnAccount) <= 1
}

/** True when removing this membership would leave the account with zero owners. */
export function wouldViolateLastOwnerOnRemove(
  membership: { role: MembershipRole },
  allOnAccount: { role: MembershipRole }[],
): boolean {
  if (membership.role !== 'OWNER') return false
  return countOwners(allOnAccount) <= 1
}

export function buildCustomerActivationRedirect(customerAccountId: string, locale: CustomerAccessLocale): string {
  const params = new URLSearchParams({ accountId: customerAccountId, locale })
  return `/api/portal/activate-account?${params.toString()}`
}

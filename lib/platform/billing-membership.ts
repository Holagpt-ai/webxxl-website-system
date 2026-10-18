import type { BillingGroupMembershipRecord } from '@/lib/platform/wallet/types'

export type ActiveFundingConflict = {
  customerAccountId: string
  existingMembershipId: string
  attemptedMembershipId: string
}

export function isActiveFundingMembership(membership: BillingGroupMembershipRecord, at: Date): boolean {
  if (membership.status !== 'ACTIVE') return false
  if (!membership.walletUseAllowed) return false
  if (membership.validTo && membership.validTo <= at) return false
  if (membership.validFrom > at) return false
  return true
}

/** At most one ACTIVE funded membership per customer account at a given time. */
export function findActiveFundingConflict(
  memberships: BillingGroupMembershipRecord[],
  candidate: BillingGroupMembershipRecord,
  at: Date,
): ActiveFundingConflict | null {
  if (!isActiveFundingMembership(candidate, at)) return null
  const conflict = memberships.find(
    (item) =>
      item.id !== candidate.id &&
      item.customerAccountId === candidate.customerAccountId &&
      isActiveFundingMembership(item, at),
  )
  if (!conflict) return null
  return {
    customerAccountId: candidate.customerAccountId,
    existingMembershipId: conflict.id,
    attemptedMembershipId: candidate.id,
  }
}

export function assertActiveFundingKey(membership: BillingGroupMembershipRecord, at: Date): string | null {
  if (!isActiveFundingMembership(membership, at)) return null
  return membership.customerAccountId
}

export function activateFundingMembership(
  memberships: BillingGroupMembershipRecord[],
  membershipId: string,
  at: Date,
): { ok: true; membership: BillingGroupMembershipRecord } | { ok: false; reason: 'NOT_FOUND' | 'ACTIVE_FUNDING_CONFLICT' } {
  const membership = memberships.find((item) => item.id === membershipId)
  if (!membership) return { ok: false, reason: 'NOT_FOUND' }
  membership.status = 'ACTIVE'
  membership.validFrom = membership.validFrom > at ? at : membership.validFrom
  membership.validTo = null
  membership.walletUseAllowed = true
  const conflict = findActiveFundingConflict(memberships, membership, at)
  if (conflict) return { ok: false, reason: 'ACTIVE_FUNDING_CONFLICT' }
  membership.activeFundingKey = membership.customerAccountId
  return { ok: true, membership }
}

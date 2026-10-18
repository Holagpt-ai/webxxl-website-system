import type { BillingGroupRoleKind } from '@/lib/platform/wallet/types'

export type OperatingMembership = {
  userId: string
  customerAccountId: string
}

export type BillingRoleAssignment = {
  userId: string
  billingGroupId: string
  role: BillingGroupRoleKind
}

export type FundingMembership = {
  billingGroupId: string
  customerAccountId: string
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'UNLINKED'
  validFrom: Date
  validTo: Date | null
  walletUseAllowed: boolean
}

export function isEffectiveFundingMembership(membership: FundingMembership, at: Date): boolean {
  if (membership.status !== 'ACTIVE') return false
  if (!membership.walletUseAllowed) return false
  if (membership.validFrom > at) return false
  if (membership.validTo && membership.validTo <= at) return false
  return true
}

export function canAccessOperatingAccount(
  memberships: OperatingMembership[],
  userId: string,
  customerAccountId: string,
): boolean {
  return memberships.some((item) => item.userId === userId && item.customerAccountId === customerAccountId)
}

export function canAccessBillingGroup(
  roles: BillingRoleAssignment[],
  userId: string,
  billingGroupId: string,
): boolean {
  return roles.some((item) => item.userId === userId && item.billingGroupId === billingGroupId)
}

export function billingRoleGrantsCrmAccess(): boolean {
  return false
}

export function operatingMembershipGrantsGroupWalletAccess(): boolean {
  return false
}

export function canManageGroupWallet(
  roles: BillingRoleAssignment[],
  userId: string,
  billingGroupId: string,
): boolean {
  return roles.some(
    (item) =>
      item.userId === userId &&
      item.billingGroupId === billingGroupId &&
      (item.role === 'GROUP_OWNER' || item.role === 'BILLING_ADMIN'),
  )
}

export function canViewGroupWallet(
  roles: BillingRoleAssignment[],
  userId: string,
  billingGroupId: string,
): boolean {
  return canAccessBillingGroup(roles, userId, billingGroupId)
}

export function canAccountSpendFromGroup(
  funding: FundingMembership[],
  customerAccountId: string,
  billingGroupId: string,
  at: Date,
): boolean {
  return funding.some(
    (item) =>
      item.customerAccountId === customerAccountId &&
      item.billingGroupId === billingGroupId &&
      isEffectiveFundingMembership(item, at),
  )
}

export function resolveAccountBillingGroup(
  funding: FundingMembership[],
  customerAccountId: string,
  at: Date,
): string | null {
  const match = funding.find(
    (item) => item.customerAccountId === customerAccountId && isEffectiveFundingMembership(item, at),
  )
  return match?.billingGroupId ?? null
}

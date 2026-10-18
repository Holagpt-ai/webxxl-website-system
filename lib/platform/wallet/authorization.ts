import {
  canAccessOperatingAccount,
  canManageGroupWallet,
  canViewGroupWallet,
} from '@/lib/platform/billing-authz'
import type { InMemoryPlatformStore } from '@/lib/platform/wallet/in-memory-store'
import type { BillingGroupRoleRecord } from '@/lib/platform/wallet/types'

export type WalletActorType = 'USER' | 'SERVICE'

export type WalletActor = {
  actorId: string
  actorType: WalletActorType
}

export function canViewWalletBalance(
  roles: BillingGroupRoleRecord[],
  actor: WalletActor,
  billingGroupId: string,
): boolean {
  if (actor.actorType === 'SERVICE') return true
  return canViewGroupWallet(roles, actor.actorId, billingGroupId)
}

/** Operating account member (or trusted service actor) may initiate metered usage against a funded account. */
export function canInitiateAccountWalletUsage(
  store: InMemoryPlatformStore,
  actor: WalletActor,
  customerAccountId: string,
): boolean {
  if (actor.actorType === 'SERVICE') return true
  return canAccessOperatingAccount(store.operatingMemberships, actor.actorId, customerAccountId)
}

/** Top-up, settlement, release, and refund require group billing admin/owner or a service actor. */
export function canPerformPrivilegedWalletOperation(
  roles: BillingGroupRoleRecord[],
  actor: WalletActor,
  billingGroupId: string,
): boolean {
  if (actor.actorType === 'SERVICE') return true
  return canManageGroupWallet(roles, actor.actorId, billingGroupId)
}

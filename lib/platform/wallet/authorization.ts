import {
  canAccessOperatingAccount,
  canManageGroupWallet,
  canViewGroupWallet,
} from '@/lib/platform/billing-authz'
import type { InMemoryPlatformStore } from '@/lib/platform/wallet/in-memory-store'
import type { BillingGroupRoleRecord, WalletDenial } from '@/lib/platform/wallet/types'

export type WalletActorType = 'USER' | 'SERVICE'

export type WalletActor = {
  actorId: string
  actorType: WalletActorType
}

export type WalletActorResolve =
  | { ok: true; actor: WalletActor }
  | { ok: false; error: Extract<WalletDenial, 'FORGED_SERVICE_ACTOR'> }

/** Caller-supplied actorType is never trusted; SERVICE requires a server-side registry entry. */
export function resolveWalletActor(
  store: InMemoryPlatformStore,
  actorId: string,
  requestedActorType?: WalletActorType,
): WalletActorResolve {
  if (requestedActorType === 'SERVICE') {
    if (!store.trustedWalletServiceActors.has(actorId)) {
      return { ok: false, error: 'FORGED_SERVICE_ACTOR' }
    }
    return { ok: true, actor: { actorId, actorType: 'SERVICE' } }
  }
  return { ok: true, actor: { actorId, actorType: 'USER' } }
}

export function isTrustedWalletServiceActor(store: InMemoryPlatformStore, actorId: string): boolean {
  return store.trustedWalletServiceActors.has(actorId)
}

export function canViewWalletBalance(
  store: InMemoryPlatformStore,
  roles: BillingGroupRoleRecord[],
  actor: WalletActor,
  billingGroupId: string,
): boolean {
  if (actor.actorType === 'SERVICE') {
    return isTrustedWalletServiceActor(store, actor.actorId)
  }
  return canViewGroupWallet(roles, actor.actorId, billingGroupId)
}

/** Operating account member or a registered internal service may initiate metered usage. */
export function canInitiateAccountWalletUsage(
  store: InMemoryPlatformStore,
  actor: WalletActor,
  customerAccountId: string,
): boolean {
  if (actor.actorType === 'SERVICE') {
    return isTrustedWalletServiceActor(store, actor.actorId)
  }
  return canAccessOperatingAccount(store.operatingMemberships, actor.actorId, customerAccountId)
}

/** Top-up, settlement, release, and refund require billing admin/owner or a registered internal service. */
export function canPerformPrivilegedWalletOperation(
  store: InMemoryPlatformStore,
  roles: BillingGroupRoleRecord[],
  actor: WalletActor,
  billingGroupId: string,
): boolean {
  if (actor.actorType === 'SERVICE') {
    return isTrustedWalletServiceActor(store, actor.actorId)
  }
  return canManageGroupWallet(roles, actor.actorId, billingGroupId)
}

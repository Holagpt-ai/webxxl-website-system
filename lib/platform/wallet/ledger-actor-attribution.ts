import type { WalletMutationPrincipal } from '@/lib/platform/wallet/mutation-principal'

export type LedgerActorAttribution = {
  actorUserId: string | null
  actorServiceId: string | null
}

export function ledgerActorAttributionFromPrincipal(
  principal: WalletMutationPrincipal,
): LedgerActorAttribution {
  if (principal.kind === 'USER') {
    return { actorUserId: principal.userId, actorServiceId: null }
  }
  return { actorUserId: null, actorServiceId: principal.serviceId }
}

export function isSyntheticServiceActorUserId(actorUserId: string | null | undefined): boolean {
  return typeof actorUserId === 'string' && actorUserId.startsWith('service:')
}

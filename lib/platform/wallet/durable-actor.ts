import type { WalletDenial } from '@/lib/platform/wallet/types'

export type DurableWalletActorType = 'USER' | 'SERVICE'

export type DurableWalletActor = {
  actorId: string
  actorType: DurableWalletActorType
}

export type DurableWalletActorResolve =
  | { ok: true; actor: DurableWalletActor }
  | { ok: false; error: Extract<WalletDenial, 'FORGED_SERVICE_ACTOR'> }

/** Server-side registry for internal wallet mutations; never trust request JSON actorType. */
export const TRUSTED_WALLET_SERVICE_ACTORS = new Set([
  'service:webxxl-wallet-settlement',
  'service:webxxl-wallet-reservation',
  'service:webxxl-comms-gateway',
  'service:webxxl-wallet-reconciliation',
])

export function resolveDurableWalletActor(
  actorId: string,
  requestedActorType?: DurableWalletActorType,
): DurableWalletActorResolve {
  if (requestedActorType === 'SERVICE') {
    if (!TRUSTED_WALLET_SERVICE_ACTORS.has(actorId)) {
      return { ok: false, error: 'FORGED_SERVICE_ACTOR' }
    }
    return { ok: true, actor: { actorId, actorType: 'SERVICE' } }
  }
  return { ok: true, actor: { actorId, actorType: 'USER' } }
}

export function isTrustedWalletServiceActor(actorId: string): boolean {
  return TRUSTED_WALLET_SERVICE_ACTORS.has(actorId)
}

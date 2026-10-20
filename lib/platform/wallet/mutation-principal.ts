import type { WalletDenial } from '@/lib/platform/wallet/types'

/** Server-constructed principals only — never accept arbitrary client service strings. */
export type TrustedWalletServiceId =
  | 'wallet-settlement'
  | 'wallet-reservation'
  | 'comms-gateway'
  | 'wallet-reconciliation'
  | 'wallet-expiry'
  | 'commerce-fulfillment'

const SERVICE_ACTOR_ID: Record<TrustedWalletServiceId, string> = {
  'wallet-settlement': 'service:webxxl-wallet-settlement',
  'wallet-reservation': 'service:webxxl-wallet-reservation',
  'comms-gateway': 'service:webxxl-comms-gateway',
  'wallet-reconciliation': 'service:webxxl-wallet-reconciliation',
  'wallet-expiry': 'service:webxxl-wallet-expiry',
  'commerce-fulfillment': 'service:webxxl-commerce-fulfillment',
}

export type WalletMutationPrincipal =
  | { kind: 'USER'; userId: string }
  | { kind: 'SERVICE'; serviceId: TrustedWalletServiceId }

export type WalletMutationOperation =
  | 'RESERVE'
  | 'SETTLE'
  | 'RELEASE'
  | 'EXPIRE'
  | 'REFUND'
  | 'RECONCILE'
  | 'FUND'

const SERVICE_OPS: Record<TrustedWalletServiceId, WalletMutationOperation[]> = {
  'wallet-settlement': ['SETTLE', 'RELEASE', 'FUND', 'REFUND'],
  'wallet-reservation': ['RESERVE'],
  'comms-gateway': ['RESERVE'],
  'wallet-reconciliation': ['RECONCILE', 'SETTLE'],
  'wallet-expiry': ['EXPIRE', 'RELEASE'],
  'commerce-fulfillment': ['FUND'],
}

export function walletPrincipalActorId(principal: WalletMutationPrincipal): string {
  return principal.kind === 'USER' ? principal.userId : SERVICE_ACTOR_ID[principal.serviceId]
}

export function assertServicePrincipalForOperation(
  principal: WalletMutationPrincipal,
  operation: WalletMutationOperation,
): { ok: true } | { ok: false; error: Extract<WalletDenial, 'UNAUTHORIZED_SETTLE' | 'UNAUTHORIZED_SPEND'> } {
  if (principal.kind === 'USER') {
    return { ok: false, error: operation === 'RESERVE' ? 'UNAUTHORIZED_SPEND' : 'UNAUTHORIZED_SETTLE' }
  }
  if (!SERVICE_OPS[principal.serviceId].includes(operation)) {
    return { ok: false, error: operation === 'RESERVE' ? 'UNAUTHORIZED_SPEND' : 'UNAUTHORIZED_SETTLE' }
  }
  return { ok: true }
}

/** Legacy caller-supplied actorType/actorId must never grant authority. */
export function rejectLegacyActorFields(actorType?: string): void {
  if (actorType === 'SERVICE') {
    throw new Error('FORGED_SERVICE_ACTOR: use WalletMutationPrincipal instead')
  }
}

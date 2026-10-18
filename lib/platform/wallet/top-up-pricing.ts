export type WalletCreditPackVersion = {
  priceVersion: string
  creditAmount: number
  fiatMinorUnits: number
  currency: string
  providerKey?: string
}

/** Authoritative fixture packs only — not live commerce pricing. */
const FIXTURE_PACKS: WalletCreditPackVersion[] = [
  {
    priceVersion: 'wallet09-pack-1000-v1',
    creditAmount: 1000,
    fiatMinorUnits: 9900,
    currency: 'USD',
    providerKey: 'none',
  },
  {
    priceVersion: 'wallet09-pack-500-v1',
    creditAmount: 500,
    fiatMinorUnits: 5500,
    currency: 'USD',
    providerKey: 'none',
  },
]

export function resolveWalletCreditPack(
  priceVersion: string,
  creditAmount: number,
): WalletCreditPackVersion | null {
  return (
    FIXTURE_PACKS.find((pack) => pack.priceVersion === priceVersion && pack.creditAmount === creditAmount) ?? null
  )
}

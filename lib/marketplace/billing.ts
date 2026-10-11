/** Provider-neutral billing hooks — no payment execution in Batch 11. */

export type BillingProviderId = 'stripe' | 'paddle' | 'lemon_squeezy' | 'manual' | 'none'

export type ServiceOrderBillingSnapshot = {
  webxxlOrderId: string
  provider: BillingProviderId
  providerReference?: string | null
  quoteAmountCents?: number | null
  quoteCurrency?: string | null
}

export function emptyBillingSnapshot(webxxlOrderId: string): ServiceOrderBillingSnapshot {
  return { webxxlOrderId, provider: 'none', providerReference: null }
}

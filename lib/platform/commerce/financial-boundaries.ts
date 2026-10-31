import type { CommerceResult, ProductRecord } from '@/lib/platform/commerce/types'

/** Distinct financial instruments — money checkout, shared wallet credits, and included FREE software. */
export type FinancialInstrument = 'MONEY_PURCHASE' | 'MESSAGING_WALLET_CREDITS' | 'INCLUDED_FREE_SOFTWARE'

export function classifyFinancialInstrument(product: ProductRecord): FinancialInstrument {
  if (product.pricingMode === 'INCLUDED_FREE' || !product.purchasable) {
    return 'INCLUDED_FREE_SOFTWARE'
  }
  if (product.creditEligible || product.kind === 'MESSAGING_CREDITS') {
    return 'MESSAGING_WALLET_CREDITS'
  }
  return 'MONEY_PURCHASE'
}

/** Payer authority for purchases does not grant CRM, campaigns, or private customer operational data. */
export const BILLING_PAYER_OPERATIONAL_ISOLATION =
  'BillingGroup payer authority covers purchases, invoices, and wallet funding only. It does not grant CustomerAccount CRM, conversation, or campaign access.'

export function assertPurchaseInstrumentAllowed(product: ProductRecord): CommerceResult<FinancialInstrument> {
  const instrument = classifyFinancialInstrument(product)
  if (instrument === 'INCLUDED_FREE_SOFTWARE') {
    return { ok: false, error: 'POLICY_UNRESOLVED', message: 'Included FREE software is not purchasable through commerce checkout.' }
  }
  return { ok: true, value: instrument }
}

/** Money-denominated service/hosting/domain orders must never debit messaging wallet credits during fulfillment. */
export function assertFulfillmentDoesNotDebitWallet(product: ProductRecord, debitsWalletCredits: boolean): CommerceResult<true> {
  const instrument = classifyFinancialInstrument(product)
  if (instrument === 'MONEY_PURCHASE' && debitsWalletCredits) {
    return {
      ok: false,
      error: 'VALIDATION',
      message: 'Money orders cannot silently debit messaging wallet credits.',
    }
  }
  return { ok: true, value: true }
}

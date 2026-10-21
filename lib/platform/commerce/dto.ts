import type { FinancialOrderDto } from '@/lib/platform/commerce/types'

/** Stable v0 contract — legacy marketplace request linked to a commerce order when present. */
export type LegacyMarketplaceLinkDto = {
  serviceOrderId: string
  publicId: string
  serviceKey: string
  status: string
  quoteAmountCents: number | null
  quoteCurrency: string | null
}

export type PurchaseHistoryOrderDto = FinancialOrderDto & {
  createdAt: string
  updatedAt: string
  legacyMarketplace: LegacyMarketplaceLinkDto | null
  checkoutEnabled: false
  paymentConfirmed: boolean
}

export type BillingGroupMemberAccountDto = {
  customerAccountId: string
  businessName: string
  slug: string
  fundingStatus: 'ACTIVE' | 'PENDING' | 'SUSPENDED' | 'UNLINKED'
  walletUseAllowed: boolean
}

export type BillingGroupSummaryDto = {
  id: string
  name: string
  slug: string
  status: string
  defaultCurrency: string
  callerRole: 'GROUP_OWNER' | 'BILLING_ADMIN' | 'BILLING_VIEWER' | null
  memberAccounts: BillingGroupMemberAccountDto[]
  commerceBackendEnabled: boolean
  walletBackendEnabled: boolean
  walletGroupReadEnabled: boolean
  checkoutEnabled: false
}

export type WalletSummaryDto = {
  billingGroupId: string
  walletId: string | null
  creditType: string
  unit: string
  postedBalance: number | null
  reservedBalance: number | null
  availableBalance: number | null
  walletBackendEnabled: boolean
  walletGroupReadEnabled: boolean
  readDisabledReason: 'WALLET_DISABLED' | 'WALLET_READ_DISABLED' | null
}

export type AdminCatalogProductDto = {
  productKey: string
  publicId: string
  name: string
  kind: string
  status: string
  pricingMode: string
  purchasable: boolean
  eligibilityCohort: string
  entitlementKey: string | null
  creditEligible: boolean
  prices: Array<{
    id: string
    publicId: string
    currency: string
    amountMinor: number
    billingInterval: string
    priceVersion: string
    status: string
    creditAmount: number | null
    effectiveFrom: string
    effectiveTo: string | null
  }>
}

export type MarketplaceRequestHistoryDto = {
  serviceOrderId: string
  publicId: string
  serviceKey: string
  status: string
  customerNotes: string | null
  quoteAmountCents: number | null
  quoteCurrency: string | null
  projectId: string | null
  createdAt: string
  updatedAt: string
  commerceOrder: { id: string; publicId: string; status: string } | null
}

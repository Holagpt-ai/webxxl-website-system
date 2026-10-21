export type {
  AdminCatalogProductDto,
  BillingGroupSummaryDto,
  MarketplaceRequestHistoryDto,
  PurchaseHistoryOrderDto,
  WalletSummaryDto,
} from '@/lib/platform/commerce/dto'
export type { PageResult } from '@/lib/platform/commerce/pagination'
export type { FinancialOrderDto } from '@/lib/platform/commerce/types'

/** Row shape of GET /api/v1/commerce/catalog (`{ catalog: CatalogRow[] }`). */
export type CatalogRow = {
  productKey: string
  publicId: string
  name: string
  kind: string
  status: string
  pricingMode: string
  purchasable: boolean
  eligibilityCohort: string
  entitlementKey: string | null
  prices: Array<{
    id: string
    publicId: string
    currency: string
    amountMinor: number
    billingInterval: string
    priceVersion: string
    creditAmount: number | null
    status: string
  }>
}

/** Row shape of GET /api/v1/commerce/accounts/{id}/services. */
export type AccountServiceRow = {
  id: string
  projectId: string | null
  customerAccountId: string
  productKey: string
  status: string
  commerceOrderId: string | null
}

/** Mirrors the backend OPEN-001 rule so the UI never offers a blocked activation. */
export function isOpen001Protected(product: { pricingMode: string; eligibilityCohort: string; kind: string }) {
  return product.pricingMode === 'INCLUDED_FREE' || product.eligibilityCohort === 'UNRESOLVED' || product.kind === 'AI_WORKFORCE'
}

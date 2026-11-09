import type { COMMERCE_EXECUTION_SOURCE_MODULES } from '@/lib/platform/commerce-execution/constants'
import type { FinancialInstrument } from '@/lib/platform/commerce/financial-boundaries'
import type { CommerceProviderKey } from '@/config/commerce-backend'
import type {
  InvoiceRecord,
  OrderStatus,
  PaymentStatus,
  SubscriptionStatus,
} from '@/lib/platform/commerce/types'

export type CommerceExecutionSourceModule = (typeof COMMERCE_EXECUTION_SOURCE_MODULES)[number]

export type CommerceExecutionSlice<T> =
  | {
      status: 'AVAILABLE'
      sourceModule: CommerceExecutionSourceModule
      data: T
    }
  | {
      status: 'UNAVAILABLE'
      sourceModule: CommerceExecutionSourceModule
      reasonCode: string
      message: string
    }

/** Honest internal managed-service lifecycle — compatible with existing ServiceOrder / infra enums. */
export type ManagedServiceLifecycleState =
  | 'REQUESTED'
  | 'QUOTED'
  | 'PENDING_APPROVAL'
  | 'PENDING_PAYMENT'
  | 'READY_FOR_PROVISIONING'
  | 'ACTIVE'
  | 'FAILED'
  | 'CANCELLED'

export type CatalogEntitlementRow = {
  productKey: string
  kind: string
  name: string
  pricingMode: string
  purchasable: boolean
  creditEligible: boolean
  eligibilityCohort: string
  entitlementKey: string | null
  instrument: FinancialInstrument
  providerPassThrough: boolean
}

export type CatalogEntitlementsSliceData = {
  products: CatalogEntitlementRow[]
  subscriberOnlyPreserved: true
  includedFreeNotPayable: true
  note: string
}

export type PurchaseHistoryRow = {
  orderId: string
  publicId: string
  billingGroupId: string
  customerAccountId: string | null
  status: OrderStatus
  currency: string
  totalMinor: number
  productKeys: string[]
  instruments: FinancialInstrument[]
  createdAt: string
}

export type PurchaseHistorySliceData = {
  orders: PurchaseHistoryRow[]
  isolationBoundary: 'CUSTOMER_ACCOUNT'
  billingGroupDoesNotGrantSiblingPurchaseVisibility: true
}

export type BillingGroupPayerSliceData = {
  billingGroupId: string | null
  payerAuthorized: boolean
  callerRole: string | null
  memberAccountIds: string[]
  operationalIsolation: string
  abmedPatternSupported: true
}

export type WalletInstrumentBoundarySliceData = {
  messagingCreditType: 'MESSAGING'
  moneyPurchasesDebitWallet: false
  hostingDomainSubscriptionUseWallet: false
  billingGroupId: string | null
  walletId: string | null
  availableCredits: number | null
  note: string
}

export type PaymentProviderReadinessSliceData = {
  commerceBackendEnabled: boolean
  checkoutEnabled: boolean
  liveProviderEnabled: boolean
  webhookProcessingEnabled: boolean
  fulfillmentEnabled: boolean
  provisioningEnabled: boolean
  walletMintEnabled: boolean
  resolvedProviderKey: CommerceProviderKey
  liveChargeBlocked: true
  checkoutBlockedCode: string
  checkoutBlockedMessage: string
  supportedProviderKeys: CommerceProviderKey[]
}

export type ManagedServiceLifecycleRow = {
  serviceKey: string
  productKey: string
  customerAccountId: string
  lifecycle: ManagedServiceLifecycleState
  webxxlRecordPresent: boolean
  providerActivated: boolean
  dataSource: 'MANUAL' | 'PROVIDER_VERIFIED' | 'NONE'
  externalProviderRef: string | null
  commerceOrderId: string | null
  orderStatus: OrderStatus | null
  paymentStatus: PaymentStatus | null
  note: string
}

export type ManagedServicesLifecycleSliceData = {
  services: ManagedServiceLifecycleRow[]
  activeRequiresProviderEvidence: true
  provisioningLiveBlocked: true
}

export type SubscriptionStateRow = {
  subscriptionId: string
  publicId: string
  customerAccountId: string | null
  productId: string
  status: SubscriptionStatus
  billingGroupId: string
  externalSubscriptionRef: string | null
  providerActivated: boolean
}

export type SubscriptionStateSliceData = {
  subscriptions: SubscriptionStateRow[]
  providerSubscriptionCallsBlocked: boolean
}

export type InvoiceReferenceRow = {
  invoiceId: string
  publicId: string
  billingGroupId: string
  customerAccountId: string | null
  orderId: string | null
  subscriptionId: string | null
  status: string
  amountMinor: number
  currency: string
  externalInvoiceRef: string | null
}

export type InvoiceReferencesSliceData = {
  invoices: InvoiceReferenceRow[]
  note: string
}

export type FulfillmentPolicySliceData = {
  paymentEvidenceRequired: true
  duplicateCheckoutRejected: true
  duplicateWebhookRejected: true
  moneyOrdersNeverDebitMessagingWallet: true
  historicalPriceSnapshotsPreserved: true
  includedFreeNotConvertedToPaid: true
  activationWithoutCaptureBlocked: true
}

export type CommerceExecutionSummaryResponse = {
  customerAccountId: string
  managedSiteId: string | null
  assembledAt: string
  accountScope: 'session_membership'
  batchVersion: string
  provenanceNotice: string
  planningDisclosure: string
  catalogEntitlements: CommerceExecutionSlice<CatalogEntitlementsSliceData>
  purchaseHistory: CommerceExecutionSlice<PurchaseHistorySliceData>
  billingGroupPayer: CommerceExecutionSlice<BillingGroupPayerSliceData>
  walletInstrumentBoundary: CommerceExecutionSlice<WalletInstrumentBoundarySliceData>
  paymentProviderReadiness: CommerceExecutionSlice<PaymentProviderReadinessSliceData>
  managedServicesLifecycle: CommerceExecutionSlice<ManagedServicesLifecycleSliceData>
  subscriptionState: CommerceExecutionSlice<SubscriptionStateSliceData>
  invoiceReferences: CommerceExecutionSlice<InvoiceReferencesSliceData>
  fulfillmentPolicy: CommerceExecutionSlice<FulfillmentPolicySliceData>
}

export type { InvoiceRecord }

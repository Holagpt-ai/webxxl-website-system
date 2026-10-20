import type { FundingMembership } from '@/lib/platform/billing-authz'

export type CommerceError =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'POLICY_UNRESOLVED'
  | 'POLICY_CAP'
  | 'ACCOUNT_NOT_FUNDED'
  | 'PRICE_MISMATCH'
  | 'PRICE_UNAVAILABLE'
  | 'PRODUCT_INACTIVE'
  | 'IDEMPOTENCY_CONFLICT'
  | 'NOT_CONFIGURED'
  | 'PROVIDER_DISABLED'
  | 'SIGNATURE_INVALID'
  | 'OUT_OF_ORDER'
  | 'DUPLICATE'
  | 'FORBIDDEN_TRANSITION'
  | 'ORDER_NOT_FOUND'
  | 'PAYMENT_NOT_CONFIRMED'
  | 'MINT_DISABLED'
  | 'PROVISIONING_DISABLED'
  | 'REDIRECT_NOT_CONFIRMATION'
  | 'TENANT_MISMATCH'
  | 'VALIDATION'
  | 'WALLET_NOT_FOUND'

export type CommerceResult<T> = { ok: true; value: T } | { ok: false; error: CommerceError; message?: string }

export type CommerceActor = {
  userId: string
  platformRole: 'CUSTOMER' | 'STAFF' | 'ADMIN'
}

export type ProductKind =
  | 'WEBSITE_PACKAGE'
  | 'HOSTING'
  | 'DOMAIN'
  | 'CRM'
  | 'MARKETING'
  | 'SEO'
  | 'AI_WORKFORCE'
  | 'MESSAGING_CREDITS'
  | 'SUBSCRIPTION'
  | 'ADDON'

export type PricingMode = 'INCLUDED_FREE' | 'RECURRING' | 'ONE_TIME' | 'METERED_EXTERNAL'
export type BillingInterval = 'NONE' | 'MONTH' | 'YEAR'
export type ActivationStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE'
export type OrderStatus =
  | 'PENDING'
  | 'CHECKOUT_CREATED'
  | 'PAYMENT_PENDING'
  | 'PAID'
  | 'FULFILLMENT_PENDING'
  | 'FULFILLED'
  | 'FULFILLMENT_BLOCKED'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'FAILED'
export type CheckoutStatus = 'CREATED' | 'READY' | 'DISABLED' | 'EXPIRED' | 'CANCELLED'
export type PaymentStatus = 'PENDING' | 'AUTHORIZED' | 'CAPTURED' | 'FAILED' | 'REFUNDED' | 'PARTIALLY_REFUNDED' | 'CANCELLED'
export type SubscriptionStatus = 'INCOMPLETE' | 'ACTIVE' | 'PAST_DUE' | 'CANCEL_SCHEDULED' | 'CANCELLED' | 'PAUSED'
export type FulfillmentStatus = 'NOT_STARTED' | 'PREPARED' | 'BLOCKED' | 'COMPLETED' | 'FAILED'
export type WebhookStatus = 'RECEIVED' | 'DUPLICATE' | 'OUT_OF_ORDER' | 'PROCESSED' | 'FAILED' | 'IGNORED'

export type ProductRecord = {
  id: string
  publicId: string
  productKey: string
  kind: ProductKind
  name: string
  description: string | null
  status: ActivationStatus
  pricingMode: PricingMode
  entitlementKey: string | null
  creditEligible: boolean
  eligibilityCohort: string
  featureFlag: string | null
  purchasable: boolean
  providerPassThrough: boolean
  createdAt: Date
  updatedAt: Date
}

export type PriceRecord = {
  id: string
  publicId: string
  productId: string
  currency: string
  amountMinor: number
  billingInterval: BillingInterval
  status: ActivationStatus
  effectiveFrom: Date
  effectiveTo: Date | null
  priceVersion: string
  creditAmount: number | null
  includedUsage: Record<string, unknown> | null
  createdAt: Date
  updatedAt: Date
}

export type ProviderPriceMapRecord = {
  id: string
  productPriceId: string
  providerKey: string
  externalPriceRef: string | null
  status: ActivationStatus
  createdAt: Date
  updatedAt: Date
}

export type OrderRecord = {
  id: string
  publicId: string
  billingGroupId: string
  customerAccountId: string | null
  projectId: string | null
  payerUserId: string | null
  status: OrderStatus
  currency: string
  subtotalMinor: number
  taxMinor: number
  totalMinor: number
  idempotencyKey: string
  requestFingerprint: string
  serviceOrderId: string | null
  failureCode: string | null
  createdAt: Date
  updatedAt: Date
}

export type OrderItemRecord = {
  id: string
  orderId: string
  productId: string
  productPriceId: string
  productKey: string
  quantity: number
  unitAmountMinor: number
  currency: string
  priceVersion: string
  creditAmount: number | null
  snapshot: Record<string, unknown>
  createdAt: Date
}

export type CheckoutRecord = {
  id: string
  publicId: string
  orderId: string
  providerKey: string
  status: CheckoutStatus
  externalCheckoutRef: string | null
  expiresAt: Date
  idempotencyKey: string
  failureCode: string | null
  createdAt: Date
  updatedAt: Date
}

export type PaymentRecord = {
  id: string
  publicId: string
  orderId: string
  billingGroupId: string
  customerAccountId: string | null
  providerKey: string
  externalPaymentRef: string | null
  status: PaymentStatus
  amountMinor: number
  currency: string
  lastEventSequence: number
  idempotencyKey: string
  capturedAt: Date | null
  failureCode: string | null
  createdAt: Date
  updatedAt: Date
}

export type PaymentAttemptRecord = {
  id: string
  paymentId: string
  attemptNumber: number
  status: PaymentStatus
  providerEventId: string | null
  failureCode: string | null
  createdAt: Date
}

export type WebhookRecord = {
  id: string
  providerKey: string
  externalEventId: string
  eventType: string
  payloadHash: string
  signatureValid: boolean
  processingStatus: WebhookStatus
  sequenceHint: number | null
  orderId: string | null
  paymentId: string | null
  failureCode: string | null
  receivedAt: Date
  processedAt: Date | null
}

export type FulfillmentRecord = {
  id: string
  orderId: string
  kind: 'CREDIT' | 'SERVICE'
  status: FulfillmentStatus
  idempotencyKey: string
  externalPaymentRef: string | null
  walletFundingEvidenceId: string | null
  ledgerEntryId: string | null
  attemptCount: number
  lastError: string | null
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export type SubscriptionRecord = {
  id: string
  publicId: string
  billingGroupId: string
  customerAccountId: string | null
  projectId: string | null
  productId: string
  productPriceId: string
  orderId: string | null
  providerKey: string
  externalSubscriptionRef: string | null
  status: SubscriptionStatus
  billingInterval: BillingInterval
  currentPeriodStart: Date | null
  currentPeriodEnd: Date | null
  cancelAt: Date | null
  cancelledAt: Date | null
  renewalMetadata: Record<string, unknown> | null
  createdAt: Date
  updatedAt: Date
}

export type InvoiceRecord = {
  id: string
  publicId: string
  billingGroupId: string
  customerAccountId: string | null
  orderId: string | null
  subscriptionId: string | null
  providerKey: string
  externalInvoiceRef: string | null
  currency: string
  amountMinor: number
  taxMinor: number
  status: string
  issuedAt: Date | null
  createdAt: Date
}

export type ProjectServiceRecord = {
  id: string
  projectId: string
  customerAccountId: string
  commerceOrderId: string | null
  serviceOrderId: string | null
  productKey: string
  status: FulfillmentStatus
  entitlementKey: string | null
  customerServiceId: string | null
  createdAt: Date
  updatedAt: Date
}

export type ServiceOrderLink = {
  id: string
  publicId: string
  commerceOrderId: string
  customerAccountId: string
  projectId: string | null
  requestedById: string
  serviceKey: string
  status: string
  quoteAmountCents: number
  quoteCurrency: string
  billingGroupId: string
  submissionFingerprint: string
}

export type FundingRecord = {
  id: string
  billingGroupId: string
  walletId: string
  providerKey: string
  externalPaymentRef: string
  creditAmount: number
  commerceOrderId: string
  commercePaymentId: string
  priceVersion: string
  verifiedAt: Date | null
  ledgerEntryId: string | null
}

export type AuditRecord = {
  id: string
  billingGroupId: string | null
  actorUserId: string | null
  action: string
  entityType: string
  entityId: string
  metadata: Record<string, unknown> | null
  createdAt: Date
}

export type { FundingMembership }

export type FinancialOrderDto = {
  id: string
  publicId: string
  billingGroupId: string
  customerAccountId: string | null
  projectId: string | null
  status: OrderStatus
  currency: string
  subtotalMinor: number
  taxMinor: number
  totalMinor: number
  items: Array<{
    productKey: string
    quantity: number
    unitAmountMinor: number
    currency: string
    priceVersion: string
    creditAmount: number | null
  }>
}

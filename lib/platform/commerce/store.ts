import type { FundingMembership } from '@/lib/platform/billing-authz'
import type { AtomicCancelUnpaidOutcome } from '@/lib/platform/commerce/atomic-cancel'
import type {
  AuditRecord,
  CheckoutRecord,
  FulfillmentRecord,
  FundingRecord,
  InvoiceRecord,
  OrderItemRecord,
  OrderRecord,
  PaymentAttemptRecord,
  PaymentRecord,
  PriceRecord,
  ProductRecord,
  ProjectServiceRecord,
  ProviderPriceMapRecord,
  ServiceOrderLink,
  SubscriptionRecord,
  WebhookRecord,
} from '@/lib/platform/commerce/types'

export type BillingGroupProfile = {
  id: string
  name: string
  slug: string
  status: string
  defaultCurrency: string
}

export type BillingGroupMemberRow = {
  customerAccountId: string
  businessName: string
  slug: string
  status: FundingMembership['status']
  walletUseAllowed: boolean
}

export interface CommerceStore {
  findBillingGroup(id: string): Promise<BillingGroupProfile | null>
  findBillingRole(
    billingGroupId: string,
    userId: string,
  ): Promise<{ role: 'GROUP_OWNER' | 'BILLING_ADMIN' | 'BILLING_VIEWER' } | null>
  listFundingMemberships(billingGroupId: string, customerAccountId: string): Promise<FundingMembership[]>
  hasOperatingMembership(userId: string, customerAccountId: string): Promise<boolean>
  findSpendingPolicy(
    billingGroupId: string,
    customerAccountId: string,
  ): Promise<{ groupHardCap: number | null } | null>
  findWallet(billingGroupId: string): Promise<{ id: string; status: string } | null>
  findProject(id: string): Promise<{ id: string; customerAccountId: string } | null>

  listProducts(): Promise<ProductRecord[]>
  findProductByKey(productKey: string): Promise<ProductRecord | null>
  findProduct(id: string): Promise<ProductRecord | null>
  saveProduct(product: ProductRecord): Promise<void>

  listPrices(productId: string): Promise<PriceRecord[]>
  findPrice(id: string): Promise<PriceRecord | null>
  savePrice(price: PriceRecord): Promise<void>

  listProviderMaps(productPriceId: string): Promise<ProviderPriceMapRecord[]>
  saveProviderMap(map: ProviderPriceMapRecord): Promise<void>

  findOrderByIdempotency(key: string): Promise<OrderRecord | null>
  findOrder(id: string): Promise<OrderRecord | null>
  saveOrder(order: OrderRecord): Promise<void>
  listOrdersByAccount(customerAccountId: string): Promise<OrderRecord[]>
  listOrdersByGroup(billingGroupId: string): Promise<OrderRecord[]>
  countOrdersForAccount(customerAccountId: string, billingGroupId?: string | null): Promise<number>
  countOrdersForGroup(billingGroupId: string, customerAccountId?: string | null): Promise<number>
  listOrdersForAccountPage(
    customerAccountId: string,
    billingGroupId: string | null,
    skip: number,
    take: number,
  ): Promise<OrderRecord[]>
  listOrdersForGroupPage(
    billingGroupId: string,
    customerAccountId: string | null,
    skip: number,
    take: number,
  ): Promise<OrderRecord[]>
  listBillingGroupMembers(billingGroupId: string): Promise<BillingGroupMemberRow[]>

  listItems(orderId: string): Promise<OrderItemRecord[]>
  replaceItems(orderId: string, items: OrderItemRecord[]): Promise<void>

  findCheckoutByIdempotency(key: string): Promise<CheckoutRecord | null>
  findCheckoutByExternal(providerKey: string, externalCheckoutRef: string): Promise<CheckoutRecord | null>
  listCheckouts(orderId: string): Promise<CheckoutRecord[]>
  saveCheckout(checkout: CheckoutRecord): Promise<void>

  findPayment(id: string): Promise<PaymentRecord | null>
  findPaymentByOrder(orderId: string): Promise<PaymentRecord | null>
  savePayment(payment: PaymentRecord): Promise<void>

  listAttempts(paymentId: string): Promise<PaymentAttemptRecord[]>
  saveAttempt(attempt: PaymentAttemptRecord): Promise<void>

  findWebhook(providerKey: string, externalEventId: string): Promise<WebhookRecord | null>
  saveWebhook(event: WebhookRecord): Promise<void>
  listWebhooksByBillingGroup(billingGroupId: string, limit: number): Promise<WebhookRecord[]>
  listFundingByBillingGroup(billingGroupId: string, limit: number): Promise<FundingRecord[]>

  findFulfillmentByOrder(orderId: string): Promise<FulfillmentRecord | null>
  findFulfillmentByPaymentRef(externalPaymentRef: string): Promise<FulfillmentRecord | null>
  saveFulfillment(row: FulfillmentRecord): Promise<void>

  findSubscription(id: string): Promise<SubscriptionRecord | null>
  findSubscriptionByOrder(orderId: string): Promise<SubscriptionRecord | null>
  saveSubscription(row: SubscriptionRecord): Promise<void>

  findInvoiceByExternal(providerKey: string, externalInvoiceRef: string): Promise<InvoiceRecord | null>
  listInvoicesByOrder(orderId: string): Promise<InvoiceRecord[]>
  saveInvoice(row: InvoiceRecord): Promise<void>

  listProjectServicesByAccount(customerAccountId: string): Promise<ProjectServiceRecord[]>
  listProjectServicesByOrder(orderId: string): Promise<ProjectServiceRecord[]>
  saveProjectService(row: ProjectServiceRecord): Promise<void>

  findServiceOrderByCommerceOrder(commerceOrderId: string): Promise<ServiceOrderLink | null>
  saveServiceOrder(row: ServiceOrderLink): Promise<void>

  findFundingByExternal(externalPaymentRef: string): Promise<FundingRecord | null>
  saveFunding(row: FundingRecord): Promise<void>

  appendAudit(event: AuditRecord): Promise<void>
  listAudit(entityType: string, entityId: string): Promise<AuditRecord[]>

  atomicCancelUnpaidOrder(input: {
    orderId: string
    reason: string | null
    now: Date
  }): Promise<AtomicCancelUnpaidOutcome>

  listReconciliationOrderContexts(
    billingGroupId: string,
    skip: number,
    take: number,
  ): Promise<{
    totalOrders: number
    contexts: Array<{
      order: OrderRecord
      payment: PaymentRecord | null
      fulfillment: FulfillmentRecord | null
      subscription: SubscriptionRecord | null
    }>
  }>

  countFundingByBillingGroup(billingGroupId: string): Promise<number>
  countWebhooksByBillingGroup(billingGroupId: string): Promise<number>
}

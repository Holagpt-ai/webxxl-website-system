import type { FundingMembership } from '@/lib/platform/billing-authz'
import type { CommerceStore } from '@/lib/platform/commerce/store'
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

export type CommerceMemorySeed = {
  billingGroups: Array<{ id: string; name: string; slug: string; status: string; defaultCurrency: string }>
  accounts?: Array<{ id: string; businessName: string; slug: string }>
  roles: Array<{ billingGroupId: string; userId: string; role: 'GROUP_OWNER' | 'BILLING_ADMIN' | 'BILLING_VIEWER' }>
  memberships: FundingMembership[]
  operating: Array<{ userId: string; customerAccountId: string }>
  policies: Array<{ billingGroupId: string; customerAccountId: string; groupHardCap: number | null }>
  projects: Array<{ id: string; customerAccountId: string }>
  wallets: Array<{ id: string; billingGroupId: string; status: string }>
}

function upsert<T extends { id: string }>(rows: T[], row: T) {
  const index = rows.findIndex((item) => item.id === row.id)
  if (index >= 0) rows[index] = row
  else rows.push(row)
}

export function createMemoryCommerceStore(seed: CommerceMemorySeed): CommerceStore & {
  products: ProductRecord[]
  orders: OrderRecord[]
  funding: FundingRecord[]
  fulfillments: FulfillmentRecord[]
  webhooks: WebhookRecord[]
  payments: PaymentRecord[]
} {
  const products: ProductRecord[] = []
  const prices: PriceRecord[] = []
  const maps: ProviderPriceMapRecord[] = []
  const orders: OrderRecord[] = []
  const items: OrderItemRecord[] = []
  const checkouts: CheckoutRecord[] = []
  const payments: PaymentRecord[] = []
  const attempts: PaymentAttemptRecord[] = []
  const webhooks: WebhookRecord[] = []
  const fulfillments: FulfillmentRecord[] = []
  const subscriptions: SubscriptionRecord[] = []
  const invoices: InvoiceRecord[] = []
  const projectServices: ProjectServiceRecord[] = []
  const serviceOrders: ServiceOrderLink[] = []
  const funding: FundingRecord[] = []
  const audits: AuditRecord[] = []

  const store: CommerceStore = {
    async findBillingGroup(id) {
      const group = seed.billingGroups.find((row) => row.id === id)
      if (!group) return null
      return {
        id: group.id,
        name: group.name,
        slug: group.slug,
        status: group.status,
        defaultCurrency: group.defaultCurrency,
      }
    },
    async findBillingRole(billingGroupId, userId) {
      return seed.roles.find((role) => role.billingGroupId === billingGroupId && role.userId === userId) ?? null
    },
    async listFundingMemberships(billingGroupId, customerAccountId) {
      return seed.memberships.filter(
        (membership) => membership.billingGroupId === billingGroupId && membership.customerAccountId === customerAccountId,
      )
    },
    async hasOperatingMembership(userId, customerAccountId) {
      return seed.operating.some((row) => row.userId === userId && row.customerAccountId === customerAccountId)
    },
    async findSpendingPolicy(billingGroupId, customerAccountId) {
      return (
        seed.policies.find(
          (policy) => policy.billingGroupId === billingGroupId && policy.customerAccountId === customerAccountId,
        ) ?? null
      )
    },
    async findWallet(billingGroupId) {
      return seed.wallets.find((wallet) => wallet.billingGroupId === billingGroupId) ?? null
    },
    async findProject(id) {
      return seed.projects.find((project) => project.id === id) ?? null
    },
    async listProducts() {
      return [...products]
    },
    async findProductByKey(productKey) {
      return products.find((product) => product.productKey === productKey) ?? null
    },
    async findProduct(id) {
      return products.find((product) => product.id === id) ?? null
    },
    async saveProduct(product) {
      upsert(products, product)
    },
    async listPrices(productId) {
      return prices.filter((price) => price.productId === productId)
    },
    async findPrice(id) {
      return prices.find((price) => price.id === id) ?? null
    },
    async savePrice(price) {
      upsert(prices, price)
    },
    async listProviderMaps(productPriceId) {
      return maps.filter((map) => map.productPriceId === productPriceId)
    },
    async saveProviderMap(map) {
      upsert(maps, map)
    },
    async findOrderByIdempotency(key) {
      return orders.find((order) => order.idempotencyKey === key) ?? null
    },
    async findOrder(id) {
      return orders.find((order) => order.id === id) ?? null
    },
    async saveOrder(order) {
      upsert(orders, order)
    },
    async listOrdersByAccount(customerAccountId) {
      return orders.filter((order) => order.customerAccountId === customerAccountId)
    },
    async listOrdersByGroup(billingGroupId) {
      return orders.filter((order) => order.billingGroupId === billingGroupId)
    },
    async countOrdersForAccount(customerAccountId, billingGroupId) {
      return orders.filter((order) => {
        if (order.customerAccountId !== customerAccountId) return false
        if (billingGroupId && order.billingGroupId !== billingGroupId) return false
        return true
      }).length
    },
    async countOrdersForGroup(billingGroupId, customerAccountId) {
      return orders.filter((order) => {
        if (order.billingGroupId !== billingGroupId) return false
        if (customerAccountId && order.customerAccountId !== customerAccountId) return false
        return true
      }).length
    },
    async listOrdersForAccountPage(customerAccountId, billingGroupId, skip, take) {
      return orders
        .filter((order) => {
          if (order.customerAccountId !== customerAccountId) return false
          if (billingGroupId && order.billingGroupId !== billingGroupId) return false
          return true
        })
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(skip, skip + take)
    },
    async listOrdersForGroupPage(billingGroupId, customerAccountId, skip, take) {
      return orders
        .filter((order) => {
          if (order.billingGroupId !== billingGroupId) return false
          if (customerAccountId && order.customerAccountId !== customerAccountId) return false
          return true
        })
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(skip, skip + take)
    },
    async listBillingGroupMembers(billingGroupId) {
      const accountById = new Map((seed.accounts ?? []).map((a) => [a.id, a]))
      return seed.memberships
        .filter((m) => m.billingGroupId === billingGroupId)
        .map((m) => {
          const account = accountById.get(m.customerAccountId)
          return {
            customerAccountId: m.customerAccountId,
            businessName: account?.businessName ?? m.customerAccountId,
            slug: account?.slug ?? m.customerAccountId,
            status: m.status,
            walletUseAllowed: m.walletUseAllowed,
          }
        })
    },
    async listItems(orderId) {
      return items.filter((item) => item.orderId === orderId)
    },
    async replaceItems(orderId, next) {
      for (let i = items.length - 1; i >= 0; i -= 1) {
        if (items[i].orderId === orderId) items.splice(i, 1)
      }
      items.push(...next)
    },
    async findCheckoutByIdempotency(key) {
      return checkouts.find((checkout) => checkout.idempotencyKey === key) ?? null
    },
    async findCheckoutByExternal(providerKey, externalCheckoutRef) {
      return (
        checkouts.find(
          (checkout) => checkout.providerKey === providerKey && checkout.externalCheckoutRef === externalCheckoutRef,
        ) ?? null
      )
    },
    async listCheckouts(orderId) {
      return checkouts.filter((checkout) => checkout.orderId === orderId)
    },
    async saveCheckout(checkout) {
      upsert(checkouts, checkout)
    },
    async findPayment(id) {
      return payments.find((payment) => payment.id === id) ?? null
    },
    async findPaymentByOrder(orderId) {
      return payments.find((payment) => payment.orderId === orderId) ?? null
    },
    async savePayment(payment) {
      upsert(payments, payment)
    },
    async listAttempts(paymentId) {
      return attempts.filter((attempt) => attempt.paymentId === paymentId)
    },
    async saveAttempt(attempt) {
      upsert(attempts, attempt)
    },
    async findWebhook(providerKey, externalEventId) {
      return webhooks.find((event) => event.providerKey === providerKey && event.externalEventId === externalEventId) ?? null
    },
    async saveWebhook(event) {
      upsert(webhooks, event)
    },
    async listWebhooksByBillingGroup(billingGroupId, limit) {
      const orderIds = new Set(orders.filter((row) => row.billingGroupId === billingGroupId).map((row) => row.id))
      return webhooks
        .filter((event) => event.orderId && orderIds.has(event.orderId))
        .sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime())
        .slice(0, limit)
    },
    async listFundingByBillingGroup(billingGroupId, limit) {
      return funding.filter((row) => row.billingGroupId === billingGroupId).slice(0, limit)
    },
    async findFulfillmentByOrder(orderId) {
      return fulfillments.find((row) => row.orderId === orderId) ?? null
    },
    async findFulfillmentByPaymentRef(externalPaymentRef) {
      return fulfillments.find((row) => row.externalPaymentRef === externalPaymentRef) ?? null
    },
    async saveFulfillment(row) {
      upsert(fulfillments, row)
    },
    async findSubscription(id) {
      return subscriptions.find((row) => row.id === id) ?? null
    },
    async findSubscriptionByOrder(orderId) {
      return subscriptions.find((row) => row.orderId === orderId) ?? null
    },
    async saveSubscription(row) {
      upsert(subscriptions, row)
    },
    async findInvoiceByExternal(providerKey, externalInvoiceRef) {
      return (
        invoices.find((row) => row.providerKey === providerKey && row.externalInvoiceRef === externalInvoiceRef) ?? null
      )
    },
    async listInvoicesByOrder(orderId) {
      return invoices.filter((row) => row.orderId === orderId)
    },
    async saveInvoice(row) {
      upsert(invoices, row)
    },
    async listProjectServicesByAccount(customerAccountId) {
      return projectServices.filter((row) => row.customerAccountId === customerAccountId)
    },
    async listProjectServicesByOrder(orderId) {
      return projectServices.filter((row) => row.commerceOrderId === orderId)
    },
    async saveProjectService(row) {
      upsert(projectServices, row)
    },
    async findServiceOrderByCommerceOrder(commerceOrderId) {
      return serviceOrders.find((row) => row.commerceOrderId === commerceOrderId) ?? null
    },
    async saveServiceOrder(row) {
      upsert(serviceOrders, row)
    },
    async findFundingByExternal(externalPaymentRef) {
      return funding.find((row) => row.externalPaymentRef === externalPaymentRef) ?? null
    },
    async saveFunding(row) {
      const existing = funding.find((item) => item.externalPaymentRef === row.externalPaymentRef && item.id !== row.id)
      if (existing) {
        const error = new Error('Unique constraint') as Error & { code: string }
        error.code = 'P2002'
        throw error
      }
      upsert(funding, row)
    },
    async appendAudit(event) {
      audits.push(event)
    },
    async listAudit(entityType, entityId) {
      return audits.filter((event) => event.entityType === entityType && event.entityId === entityId)
    },
  }

  return Object.assign(store, { products, orders, funding, fulfillments, webhooks, payments })
}

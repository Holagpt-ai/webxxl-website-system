import { Prisma, type CommerceProduct } from '@prisma/client'
import type { FundingMembership } from '@/lib/platform/billing-authz'
import { hasUnconfirmedProviderCheckout, UNPAID_CANCELLABLE_ORDER_STATUSES } from '@/lib/platform/commerce/atomic-cancel'
import { prisma } from '@/lib/db'
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

function json(value: Record<string, unknown> | null): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value == null) return Prisma.JsonNull
  return value as Prisma.InputJsonValue
}

function recordJson(value: Prisma.JsonValue | null): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function mapProduct(row: CommerceProduct): ProductRecord {
  return {
    id: row.id,
    publicId: row.publicId,
    productKey: row.productKey,
    kind: row.kind,
    name: row.name,
    description: row.description,
    status: row.status,
    pricingMode: row.pricingMode,
    entitlementKey: row.entitlementKey,
    creditEligible: row.creditEligible,
    eligibilityCohort: row.eligibilityCohort,
    featureFlag: row.featureFlag,
    purchasable: row.purchasable,
    providerPassThrough: row.providerPassThrough,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export const prismaCommerceStore: CommerceStore = {
  async findBillingGroup(id) {
    const row = await prisma.billingGroup.findUnique({ where: { id } })
    return row
      ? { id: row.id, name: row.name, slug: row.slug, status: row.status, defaultCurrency: row.defaultCurrency }
      : null
  },
  async findBillingRole(billingGroupId, userId) {
    const row = await prisma.billingGroupRole.findUnique({ where: { billingGroupId_userId: { billingGroupId, userId } } })
    if (!row) return null
    return { role: row.role }
  },
  async listFundingMemberships(billingGroupId, customerAccountId) {
    const rows = await prisma.billingGroupMembership.findMany({ where: { billingGroupId, customerAccountId } })
    return rows.map(
      (row): FundingMembership => ({
        billingGroupId: row.billingGroupId,
        customerAccountId: row.customerAccountId,
        status: row.status,
        validFrom: row.validFrom,
        validTo: row.validTo,
        walletUseAllowed: row.walletUseAllowed,
      }),
    )
  },
  async hasOperatingMembership(userId, customerAccountId) {
    const row = await prisma.customerMembership.findFirst({ where: { userId, customerAccountId } })
    return Boolean(row)
  },
  async findSpendingPolicy(billingGroupId, customerAccountId) {
    const row = await prisma.siteSpendingPolicy.findUnique({
      where: { billingGroupId_customerAccountId: { billingGroupId, customerAccountId } },
    })
    return row ? { groupHardCap: row.groupHardCap } : null
  },
  async findWallet(billingGroupId) {
    const row = await prisma.creditWallet.findUnique({
      where: { billingGroupId_creditType: { billingGroupId, creditType: 'MESSAGING' } },
    })
    return row ? { id: row.id, status: row.status } : null
  },
  async findProject(id) {
    const row = await prisma.project.findUnique({ where: { id } })
    return row ? { id: row.id, customerAccountId: row.customerAccountId } : null
  },
  async listProducts() {
    return (await prisma.commerceProduct.findMany()).map(mapProduct)
  },
  async findProductByKey(productKey) {
    const row = await prisma.commerceProduct.findUnique({ where: { productKey } })
    return row ? mapProduct(row) : null
  },
  async findProduct(id) {
    const row = await prisma.commerceProduct.findUnique({ where: { id } })
    return row ? mapProduct(row) : null
  },
  async saveProduct(product) {
    await prisma.commerceProduct.upsert({
      where: { id: product.id },
      create: product,
      update: product,
    })
  },
  async listPrices(productId) {
    const rows = await prisma.commerceProductPrice.findMany({ where: { productId } })
    return rows.map((row) => ({ ...row, includedUsage: recordJson(row.includedUsage) }))
  },
  async findPrice(id) {
    const row = await prisma.commerceProductPrice.findUnique({ where: { id } })
    return row ? { ...row, includedUsage: recordJson(row.includedUsage) } : null
  },
  async savePrice(price: PriceRecord) {
    const data = { ...price, includedUsage: json(price.includedUsage) }
    await prisma.commerceProductPrice.upsert({ where: { id: price.id }, create: data, update: data })
  },
  async listProviderMaps(productPriceId) {
    return prisma.commerceProviderPriceMap.findMany({ where: { productPriceId } })
  },
  async saveProviderMap(map: ProviderPriceMapRecord) {
    await prisma.commerceProviderPriceMap.upsert({ where: { id: map.id }, create: map, update: map })
  },
  async findOrderByIdempotency(key) {
    return prisma.commerceOrder.findUnique({ where: { idempotencyKey: key } })
  },
  async findOrder(id) {
    return prisma.commerceOrder.findUnique({ where: { id } })
  },
  async saveOrder(order: OrderRecord) {
    await prisma.commerceOrder.upsert({ where: { id: order.id }, create: order, update: order })
  },
  async listOrdersByAccount(customerAccountId) {
    return prisma.commerceOrder.findMany({ where: { customerAccountId } })
  },
  async listOrdersByGroup(billingGroupId) {
    return prisma.commerceOrder.findMany({ where: { billingGroupId } })
  },
  async countOrdersForAccount(customerAccountId, billingGroupId) {
    return prisma.commerceOrder.count({
      where: { customerAccountId, ...(billingGroupId ? { billingGroupId } : {}) },
    })
  },
  async countOrdersForGroup(billingGroupId, customerAccountId) {
    return prisma.commerceOrder.count({
      where: { billingGroupId, ...(customerAccountId ? { customerAccountId } : {}) },
    })
  },
  async listOrdersForAccountPage(customerAccountId, billingGroupId, skip, take) {
    return prisma.commerceOrder.findMany({
      where: { customerAccountId, ...(billingGroupId ? { billingGroupId } : {}) },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    })
  },
  async listOrdersForGroupPage(billingGroupId, customerAccountId, skip, take) {
    return prisma.commerceOrder.findMany({
      where: { billingGroupId, ...(customerAccountId ? { customerAccountId } : {}) },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    })
  },
  async listBillingGroupMembers(billingGroupId) {
    const rows = await prisma.billingGroupMembership.findMany({
      where: { billingGroupId },
      include: { customerAccount: { select: { id: true, businessName: true, slug: true } } },
    })
    return rows.map((row) => ({
      customerAccountId: row.customerAccountId,
      businessName: row.customerAccount.businessName,
      slug: row.customerAccount.slug,
      status: row.status,
      walletUseAllowed: row.walletUseAllowed,
    }))
  },
  async listItems(orderId) {
    const rows = await prisma.commerceOrderItem.findMany({ where: { orderId } })
    return rows.map((row) => ({ ...row, snapshot: recordJson(row.snapshot) ?? {} }))
  },
  async replaceItems(orderId, items: OrderItemRecord[]) {
    await prisma.commerceOrderItem.deleteMany({ where: { orderId } })
    if (items.length === 0) return
    await prisma.commerceOrderItem.createMany({
      data: items.map((item) => ({ ...item, snapshot: json(item.snapshot) })),
    })
  },
  async findCheckoutByIdempotency(key) {
    return prisma.commerceCheckoutIntent.findUnique({ where: { idempotencyKey: key } })
  },
  async findCheckoutByExternal(providerKey, externalCheckoutRef) {
    return prisma.commerceCheckoutIntent.findUnique({
      where: { providerKey_externalCheckoutRef: { providerKey, externalCheckoutRef } },
    })
  },
  async listCheckouts(orderId) {
    return prisma.commerceCheckoutIntent.findMany({ where: { orderId } })
  },
  async saveCheckout(checkout: CheckoutRecord) {
    await prisma.commerceCheckoutIntent.upsert({ where: { id: checkout.id }, create: checkout, update: checkout })
  },
  async findPayment(id) {
    return prisma.commercePayment.findUnique({ where: { id } })
  },
  async findPaymentByOrder(orderId) {
    return prisma.commercePayment.findFirst({ where: { orderId } })
  },
  async savePayment(payment: PaymentRecord) {
    await prisma.commercePayment.upsert({ where: { id: payment.id }, create: payment, update: payment })
  },
  async listAttempts(paymentId) {
    return prisma.commercePaymentAttempt.findMany({ where: { paymentId }, orderBy: { attemptNumber: 'asc' } })
  },
  async saveAttempt(attempt: PaymentAttemptRecord) {
    await prisma.commercePaymentAttempt.upsert({ where: { id: attempt.id }, create: attempt, update: attempt })
  },
  async findWebhook(providerKey, externalEventId) {
    return prisma.commerceWebhookEvent.findUnique({
      where: { providerKey_externalEventId: { providerKey, externalEventId } },
    })
  },
  async saveWebhook(event: WebhookRecord) {
    await prisma.commerceWebhookEvent.upsert({ where: { id: event.id }, create: event, update: event })
  },
  async listWebhooksByBillingGroup(billingGroupId, limit) {
    return prisma.commerceWebhookEvent.findMany({
      where: { order: { billingGroupId } },
      orderBy: { receivedAt: 'desc' },
      take: limit,
    })
  },
  async listFundingByBillingGroup(billingGroupId, limit) {
    const rows = await prisma.walletFundingEvidence.findMany({
      where: { billingGroupId },
      orderBy: { verifiedAt: 'desc' },
      take: limit,
    })
    return rows.map((row) => ({
      id: row.id,
      billingGroupId: row.billingGroupId,
      walletId: row.walletId,
      providerKey: row.providerKey,
      externalPaymentRef: row.externalPaymentRef,
      creditAmount: row.creditAmount,
      commerceOrderId: row.commerceOrderId ?? '',
      commercePaymentId: row.commercePaymentId ?? '',
      priceVersion: row.priceVersion ?? '',
      verifiedAt: row.verifiedAt,
      ledgerEntryId: row.ledgerEntryId,
    }))
  },
  async findFulfillmentByOrder(orderId) {
    const row = await prisma.commerceFulfillment.findUnique({ where: { orderId } })
    return row ? { ...row, kind: row.kind === 'CREDIT' ? 'CREDIT' : 'SERVICE' } : null
  },
  async findFulfillmentByPaymentRef(externalPaymentRef) {
    const row = await prisma.commerceFulfillment.findUnique({ where: { externalPaymentRef } })
    return row ? { ...row, kind: row.kind === 'CREDIT' ? 'CREDIT' : 'SERVICE' } : null
  },
  async saveFulfillment(row: FulfillmentRecord) {
    await prisma.commerceFulfillment.upsert({ where: { id: row.id }, create: row, update: row })
  },
  async findSubscription(id) {
    const row = await prisma.commerceSubscription.findUnique({ where: { id } })
    return row ? { ...row, renewalMetadata: recordJson(row.renewalMetadata) } : null
  },
  async findSubscriptionByOrder(orderId) {
    const row = await prisma.commerceSubscription.findFirst({ where: { orderId } })
    return row ? { ...row, renewalMetadata: recordJson(row.renewalMetadata) } : null
  },
  async saveSubscription(row: SubscriptionRecord) {
    const data = { ...row, renewalMetadata: json(row.renewalMetadata) }
    await prisma.commerceSubscription.upsert({ where: { id: row.id }, create: data, update: data })
  },
  async findInvoiceByExternal(providerKey, externalInvoiceRef) {
    return prisma.commerceInvoiceReference.findUnique({
      where: { providerKey_externalInvoiceRef: { providerKey, externalInvoiceRef } },
    })
  },
  async listInvoicesByOrder(orderId) {
    return prisma.commerceInvoiceReference.findMany({ where: { orderId } })
  },
  async saveInvoice(row: InvoiceRecord) {
    await prisma.commerceInvoiceReference.upsert({ where: { id: row.id }, create: row, update: row })
  },
  async listProjectServicesByAccount(customerAccountId) {
    return prisma.projectService.findMany({ where: { customerAccountId } })
  },
  async listProjectServicesByOrder(orderId) {
    return prisma.projectService.findMany({ where: { commerceOrderId: orderId } })
  },
  async saveProjectService(row: ProjectServiceRecord) {
    await prisma.projectService.upsert({ where: { id: row.id }, create: row, update: row })
  },
  async findServiceOrderByCommerceOrder(commerceOrderId) {
    const order = await prisma.commerceOrder.findUnique({ where: { id: commerceOrderId }, include: { serviceOrder: true } })
    const row = order?.serviceOrder
    if (!row || !order) return null
    return {
      id: row.id,
      publicId: row.publicId,
      commerceOrderId,
      customerAccountId: row.customerAccountId,
      projectId: row.projectId,
      requestedById: row.requestedById,
      serviceKey: row.serviceKey,
      status: row.status,
      quoteAmountCents: row.quoteAmountCents ?? 0,
      quoteCurrency: row.quoteCurrency ?? order.currency,
      billingGroupId: row.billingGroupId ?? order.billingGroupId,
      submissionFingerprint: row.submissionFingerprint,
    }
  },
  async saveServiceOrder(row: ServiceOrderLink) {
    await prisma.serviceOrder.upsert({
      where: { id: row.id },
      create: {
        id: row.id,
        publicId: row.publicId,
        customerAccountId: row.customerAccountId,
        projectId: row.projectId,
        requestedById: row.requestedById,
        serviceKey: row.serviceKey,
        status: 'REQUESTED',
        quoteAmountCents: row.quoteAmountCents,
        quoteCurrency: row.quoteCurrency,
        billingGroupId: row.billingGroupId,
        submissionFingerprint: row.submissionFingerprint,
      },
      update: {
        quoteAmountCents: row.quoteAmountCents,
        quoteCurrency: row.quoteCurrency,
        billingGroupId: row.billingGroupId,
      },
    })
  },
  async findFundingByExternal(externalPaymentRef) {
    const row = await prisma.walletFundingEvidence.findUnique({ where: { externalPaymentRef } })
    if (!row || !row.commerceOrderId || !row.commercePaymentId) return null
    return {
      id: row.id,
      billingGroupId: row.billingGroupId,
      walletId: row.walletId,
      providerKey: row.providerKey,
      externalPaymentRef: row.externalPaymentRef,
      creditAmount: row.creditAmount,
      commerceOrderId: row.commerceOrderId,
      commercePaymentId: row.commercePaymentId,
      priceVersion: row.priceVersion ?? 'commerce-funding',
      verifiedAt: row.verifiedAt,
      ledgerEntryId: row.ledgerEntryId,
    }
  },
  async saveFunding(row: FundingRecord) {
    await prisma.walletFundingEvidence.upsert({
      where: { externalPaymentRef: row.externalPaymentRef },
      create: {
        id: row.id,
        billingGroupId: row.billingGroupId,
        walletId: row.walletId,
        providerKey: row.providerKey,
        externalPaymentRef: row.externalPaymentRef,
        creditAmount: row.creditAmount,
        commerceOrderId: row.commerceOrderId,
        commercePaymentId: row.commercePaymentId,
        priceVersion: row.priceVersion,
        verifiedAt: row.verifiedAt,
        ledgerEntryId: row.ledgerEntryId,
      },
      update: {
        ledgerEntryId: row.ledgerEntryId,
        verifiedAt: row.verifiedAt,
        creditAmount: row.creditAmount,
      },
    })
  },
  async appendAudit(event: AuditRecord) {
    await prisma.commerceAuditEvent.create({
      data: { ...event, metadata: json(event.metadata) },
    })
  },
  async listAudit(entityType, entityId) {
    const rows = await prisma.commerceAuditEvent.findMany({ where: { entityType, entityId } })
    return rows.map((row) => ({ ...row, metadata: recordJson(row.metadata) }))
  },
  async atomicCancelUnpaidOrder(input) {
    return prisma.$transaction(async (tx) => {
      const order = await tx.commerceOrder.findUnique({
        where: { id: input.orderId },
        include: { checkouts: true, payments: { orderBy: { createdAt: 'desc' }, take: 1 } },
      })
      if (!order) return { kind: 'not_found' as const }
      if (order.status === 'CANCELLED') return { kind: 'already_cancelled' as const, order }
      const payment = order.payments[0] ?? null
      if (payment?.status === 'CAPTURED') return { kind: 'payment_captured' as const, order }
      if (hasUnconfirmedProviderCheckout(order.checkouts)) {
        return { kind: 'provider_checkout_unconfirmed' as const, order }
      }
      if (!UNPAID_CANCELLABLE_ORDER_STATUSES.includes(order.status)) {
        return { kind: 'status_not_cancellable' as const, order }
      }
      const priorStatus = order.status
      const updated = await tx.commerceOrder.updateMany({
        where: {
          id: input.orderId,
          status: { in: UNPAID_CANCELLABLE_ORDER_STATUSES },
        },
        data: {
          status: 'CANCELLED',
          failureCode: input.reason ?? 'CANCELLED_BY_PAYER',
          updatedAt: input.now,
        },
      })
      if (updated.count === 0) {
        const fresh = await tx.commerceOrder.findUnique({ where: { id: input.orderId } })
        if (!fresh) return { kind: 'not_found' as const }
        if (fresh.status === 'CANCELLED') return { kind: 'already_cancelled' as const, order: fresh }
        const captured = await tx.commercePayment.findFirst({ where: { orderId: input.orderId, status: 'CAPTURED' } })
        if (captured) return { kind: 'payment_captured' as const, order: fresh }
        return { kind: 'concurrent_conflict' as const, order: fresh }
      }
      await tx.commercePayment.updateMany({
        where: { orderId: input.orderId, status: { not: 'CAPTURED' } },
        data: { status: 'CANCELLED', updatedAt: input.now },
      })
      const cancelled = await tx.commerceOrder.findUnique({ where: { id: input.orderId } })
      if (!cancelled) return { kind: 'not_found' as const }
      return { kind: 'cancelled' as const, order: cancelled, priorStatus }
    })
  },
  async listReconciliationOrderContexts(billingGroupId, skip, take) {
    const totalOrders = await prisma.commerceOrder.count({ where: { billingGroupId } })
    const rows = await prisma.commerceOrder.findMany({
      where: { billingGroupId },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      include: {
        payments: { orderBy: { createdAt: 'desc' }, take: 1 },
        fulfillment: true,
        subscriptions: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    })
    return {
      totalOrders,
      contexts: rows.map((row) => ({
        order: row,
        payment: row.payments[0] ?? null,
        fulfillment: row.fulfillment
          ? { ...row.fulfillment, kind: row.fulfillment.kind === 'CREDIT' ? ('CREDIT' as const) : ('SERVICE' as const) }
          : null,
        subscription: row.subscriptions[0]
          ? { ...row.subscriptions[0], renewalMetadata: recordJson(row.subscriptions[0].renewalMetadata) }
          : null,
      })),
    }
  },
  async countFundingByBillingGroup(billingGroupId) {
    return prisma.walletFundingEvidence.count({ where: { billingGroupId } })
  },
  async countWebhooksByBillingGroup(billingGroupId) {
    return prisma.commerceWebhookEvent.count({ where: { order: { billingGroupId } } })
  },
}

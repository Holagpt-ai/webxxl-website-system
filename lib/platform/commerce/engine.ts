import { createHash, randomUUID } from 'crypto'
import { isEffectiveFundingMembership, type FundingMembership } from '@/lib/platform/billing-authz'
import {
  isCommerceFulfillmentEnabled,
  isCommerceProvisioningEnabled,
  isCommerceWebhookProcessingEnabled,
} from '@/config/commerce-backend'
import { COMMERCE_CATALOG_SKELETON } from '@/lib/platform/commerce/catalog'
import { assertFulfillmentDoesNotDebitWallet, assertPurchaseInstrumentAllowed } from '@/lib/platform/commerce/financial-boundaries'
import { getBillingProvider } from '@/lib/platform/commerce/providers'
import { canTransitionOrder, canTransitionPayment, canTransitionSubscription } from '@/lib/platform/commerce/state'
import type { CommerceStore } from '@/lib/platform/commerce/store'
import type {
  BillingInterval,
  CommerceActor,
  CommerceResult,
  FinancialOrderDto,
  FulfillmentRecord,
  OrderItemRecord,
  OrderRecord,
  PaymentRecord,
  PriceRecord,
  ProductRecord,
  WebhookRecord,
} from '@/lib/platform/commerce/types'
import { mintCreditsFromFundingEvidence } from '@/lib/platform/wallet/top-up-quote'

export type CreditMintPort = (externalPaymentRef: string) => Promise<{
  ok: boolean
  error?: string
  value?: { ledgerEntryId: string; replay: boolean }
}>

function id(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, '')}`
}

function isStaff(actor: CommerceActor): boolean {
  return actor.platformRole === 'ADMIN' || actor.platformRole === 'STAFF'
}

function isActiveMember(membership: FundingMembership, at: Date): boolean {
  if (membership.status !== 'ACTIVE') return false
  if (membership.validFrom > at) return false
  if (membership.validTo && membership.validTo <= at) return false
  return true
}

function priceCurrent(price: PriceRecord, at: Date): boolean {
  return price.status === 'ACTIVE' && price.effectiveFrom <= at && (!price.effectiveTo || price.effectiveTo > at)
}

function fingerprint(parts: Array<string | number | null>): string {
  return createHash('sha256').update(parts.map((part) => part ?? '').join('|')).digest('hex')
}

async function audit(
  store: CommerceStore,
  input: { billingGroupId?: string | null; actorUserId?: string | null; action: string; entityType: string; entityId: string; metadata?: Record<string, unknown> | null },
) {
  await store.appendAudit({
    id: id('aud'),
    billingGroupId: input.billingGroupId ?? null,
    actorUserId: input.actorUserId ?? null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    metadata: input.metadata ?? null,
    createdAt: new Date(),
  })
}

async function authorizePayer(
  store: CommerceStore,
  actor: CommerceActor,
  billingGroupId: string,
  customerAccountId: string | null,
  at: Date,
  purpose: 'CREDIT' | 'SERVICE',
): Promise<CommerceResult<{ currency: string }>> {
  const group = await store.findBillingGroup(billingGroupId)
  if (!group || group.status !== 'ACTIVE') return { ok: false, error: 'ACCOUNT_NOT_FUNDED' }
  const role = await store.findBillingRole(billingGroupId, actor.userId)
  if (!role || (role.role !== 'GROUP_OWNER' && role.role !== 'BILLING_ADMIN')) {
    return { ok: false, error: 'FORBIDDEN' }
  }
  if (customerAccountId) {
    const memberships = await store.listFundingMemberships(billingGroupId, customerAccountId)
    const allowed =
      purpose === 'CREDIT'
        ? memberships.some((membership) => isEffectiveFundingMembership(membership, at))
        : memberships.some((membership) => isActiveMember(membership, at))
    if (!allowed) return { ok: false, error: memberships.length === 0 ? 'FORBIDDEN' : 'ACCOUNT_NOT_FUNDED' }
    const policy = await store.findSpendingPolicy(billingGroupId, customerAccountId)
    if (policy?.groupHardCap === 0) return { ok: false, error: 'POLICY_CAP' }
  }
  return { ok: true, value: { currency: group.defaultCurrency } }
}

function sellable(product: ProductRecord): CommerceResult<true> {
  if (product.kind === 'AI_WORKFORCE') return { ok: false, error: 'NOT_CONFIGURED' }
  if (product.pricingMode === 'INCLUDED_FREE' || product.eligibilityCohort === 'UNRESOLVED' || !product.purchasable) {
    return { ok: false, error: 'POLICY_UNRESOLVED' }
  }
  if (product.status !== 'ACTIVE') return { ok: false, error: 'PRODUCT_INACTIVE' }
  return { ok: true, value: true }
}

export async function ensureCatalogSkeleton(store: CommerceStore): Promise<void> {
  const now = new Date()
  for (const entry of COMMERCE_CATALOG_SKELETON) {
    const existing = await store.findProductByKey(entry.productKey)
    if (existing) continue
    await store.saveProduct({
      id: id('prd'),
      publicId: id('pubprd'),
      productKey: entry.productKey,
      kind: entry.kind,
      name: entry.name,
      description: null,
      status: 'DRAFT',
      pricingMode: entry.pricingMode,
      entitlementKey: entry.entitlementKey,
      creditEligible: entry.creditEligible,
      eligibilityCohort: entry.eligibilityCohort,
      featureFlag: entry.featureFlag,
      purchasable: entry.purchasable,
      providerPassThrough: entry.providerPassThrough,
      createdAt: now,
      updatedAt: now,
    })
  }
}

export async function configureProductPrice(
  store: CommerceStore,
  input: {
    actor: CommerceActor
    productKey: string
    currency: string
    amountMinor: number
    billingInterval: BillingInterval
    priceVersion: string
    creditAmount?: number | null
    effectiveFrom: Date
    effectiveTo?: Date | null
    providerKey?: string | null
    externalPriceRef?: string | null
  },
): Promise<CommerceResult<PriceRecord>> {
  if (!isStaff(input.actor)) return { ok: false, error: 'FORBIDDEN' }
  if (!input.priceVersion || !/^[A-Z]{3}$/.test(input.currency)) return { ok: false, error: 'VALIDATION' }
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) return { ok: false, error: 'VALIDATION' }
  const product = await store.findProductByKey(input.productKey)
  if (!product) return { ok: false, error: 'PRICE_UNAVAILABLE' }
  if (product.kind === 'AI_WORKFORCE' || product.pricingMode === 'INCLUDED_FREE' || product.eligibilityCohort === 'UNRESOLVED') {
    return { ok: false, error: product.kind === 'AI_WORKFORCE' ? 'NOT_CONFIGURED' : 'POLICY_UNRESOLVED' }
  }
  if (product.creditEligible) {
    if (!input.creditAmount || !Number.isSafeInteger(input.creditAmount) || input.creditAmount <= 0) {
      return { ok: false, error: 'VALIDATION' }
    }
  }
  const prices = await store.listPrices(product.id)
  const same = prices.find((price) => price.priceVersion === input.priceVersion && price.currency === input.currency)
  if (same) {
    const matches =
      same.amountMinor === input.amountMinor &&
      same.billingInterval === input.billingInterval &&
      (same.creditAmount ?? null) === (input.creditAmount ?? null)
    if (!matches) return { ok: false, error: 'IDEMPOTENCY_CONFLICT' }
    return { ok: true, value: same }
  }
  const overlap = prices.some(
    (price) =>
      price.status === 'ACTIVE' &&
      price.currency === input.currency &&
      price.effectiveFrom < (input.effectiveTo ?? new Date('2999-01-01')) &&
      (!price.effectiveTo || price.effectiveTo > input.effectiveFrom),
  )
  if (overlap) return { ok: false, error: 'PRICE_UNAVAILABLE' }
  const now = new Date()
  const price: PriceRecord = {
    id: id('prc'),
    publicId: id('pubprc'),
    productId: product.id,
    currency: input.currency,
    amountMinor: input.amountMinor,
    billingInterval: input.billingInterval,
    status: 'ACTIVE',
    effectiveFrom: input.effectiveFrom,
    effectiveTo: input.effectiveTo ?? null,
    priceVersion: input.priceVersion,
    creditAmount: input.creditAmount ?? null,
    includedUsage: null,
    createdAt: now,
    updatedAt: now,
  }
  await store.savePrice(price)
  if (input.providerKey) {
    await store.saveProviderMap({
      id: id('map'),
      productPriceId: price.id,
      providerKey: input.providerKey,
      externalPriceRef: input.externalPriceRef ?? null,
      status: 'INACTIVE',
      createdAt: now,
      updatedAt: now,
    })
  }
  product.status = 'ACTIVE'
  product.updatedAt = now
  await store.saveProduct(product)
  await audit(store, {
    actorUserId: input.actor.userId,
    action: 'PRICE_CONFIGURED',
    entityType: 'CommerceProductPrice',
    entityId: price.id,
    metadata: { productKey: product.productKey, priceVersion: price.priceVersion },
  })
  return { ok: true, value: price }
}

export async function listCatalog(store: CommerceStore, actor: CommerceActor, at = new Date()) {
  const products = await store.listProducts()
  const visible = products.filter((product) => (isStaff(actor) ? true : product.status === 'ACTIVE' || product.pricingMode === 'INCLUDED_FREE'))
  const rows = []
  for (const product of visible) {
    const prices = (await store.listPrices(product.id)).filter((price) => (isStaff(actor) ? true : priceCurrent(price, at)))
    rows.push({
      productKey: product.productKey,
      publicId: product.publicId,
      name: product.name,
      kind: product.kind,
      status: product.status,
      pricingMode: product.pricingMode,
      purchasable: product.purchasable && product.status === 'ACTIVE' && product.pricingMode !== 'INCLUDED_FREE',
      eligibilityCohort: product.eligibilityCohort,
      entitlementKey: product.entitlementKey,
      prices:
        product.pricingMode === 'INCLUDED_FREE'
          ? []
          : prices.map((price) => ({
              id: price.id,
              publicId: price.publicId,
              currency: price.currency,
              amountMinor: price.amountMinor,
              billingInterval: price.billingInterval,
              priceVersion: price.priceVersion,
              creditAmount: price.creditAmount,
              status: price.status,
            })),
    })
  }
  return rows
}

export async function getCatalogProduct(store: CommerceStore, actor: CommerceActor, productKey: string, at = new Date()) {
  const rows = await listCatalog(store, actor, at)
  return rows.find((row) => row.productKey === productKey) ?? null
}

type QuoteInput = {
  actor: CommerceActor
  billingGroupId: string
  customerAccountId: string | null
  projectId?: string | null
  productPriceId?: string
  productKey?: string
  quantity: number
  expectedTotalMinor: number
  currency: string
  taxMinor?: number
  at?: Date
}

async function resolveQuote(store: CommerceStore, input: QuoteInput): Promise<
  CommerceResult<{
    product: ProductRecord
    price: PriceRecord
    quantity: number
    subtotalMinor: number
    taxMinor: number
    totalMinor: number
    requestFingerprint: string
  }>
> {
  const at = input.at ?? new Date()
  if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 20) {
    return { ok: false, error: 'VALIDATION' }
  }
  if ((input.taxMinor ?? 0) !== 0) return { ok: false, error: 'NOT_CONFIGURED', message: 'Tax collection is not activated' }
  const price = input.productPriceId ? await store.findPrice(input.productPriceId) : null
  if (!price || !priceCurrent(price, at)) {
    if (input.productKey) {
      const named = await store.findProductByKey(input.productKey)
      if (!named) return { ok: false, error: 'PRICE_UNAVAILABLE' }
      const decision = sellable(named)
      if (!decision.ok) return decision
    }
    return { ok: false, error: 'PRICE_UNAVAILABLE' }
  }
  const product = await store.findProduct(price.productId)
  if (!product) return { ok: false, error: 'PRICE_UNAVAILABLE' }
  const allowed = sellable(product)
  if (!allowed.ok) return allowed
  const instrument = assertPurchaseInstrumentAllowed(product)
  if (!instrument.ok) return instrument
  if (product.kind === 'MESSAGING_CREDITS' && input.quantity !== 1) return { ok: false, error: 'VALIDATION' }
  if (product.creditEligible && (!price.creditAmount || price.creditAmount <= 0)) return { ok: false, error: 'PRICE_UNAVAILABLE' }
  const payer = await authorizePayer(
    store,
    input.actor,
    input.billingGroupId,
    input.customerAccountId,
    at,
    product.creditEligible ? 'CREDIT' : 'SERVICE',
  )
  if (!payer.ok) return payer
  if (input.currency !== price.currency || input.currency !== payer.value.currency) {
    return { ok: false, error: 'PRICE_MISMATCH' }
  }
  if (input.projectId) {
    if (!input.customerAccountId) return { ok: false, error: 'VALIDATION' }
    const project = await store.findProject(input.projectId)
    if (!project || project.customerAccountId !== input.customerAccountId) return { ok: false, error: 'TENANT_MISMATCH' }
  }
  const subtotalMinor = price.amountMinor * input.quantity
  const taxMinor = 0
  const totalMinor = subtotalMinor + taxMinor
  if (input.expectedTotalMinor !== totalMinor) return { ok: false, error: 'PRICE_MISMATCH' }
  return {
    ok: true,
    value: {
      product,
      price,
      quantity: input.quantity,
      subtotalMinor,
      taxMinor,
      totalMinor,
      requestFingerprint: fingerprint([
        input.actor.userId,
        input.billingGroupId,
        input.customerAccountId,
        input.projectId ?? null,
        price.id,
        price.priceVersion,
        input.quantity,
        price.amountMinor,
        price.currency,
        taxMinor,
      ]),
    },
  }
}

export async function quotePurchase(store: CommerceStore, input: QuoteInput) {
  const quote = await resolveQuote(store, input)
  if (!quote.ok) return quote
  return {
    ok: true as const,
    value: {
      productKey: quote.value.product.productKey,
      productPriceId: quote.value.price.id,
      priceVersion: quote.value.price.priceVersion,
      currency: quote.value.price.currency,
      unitAmountMinor: quote.value.price.amountMinor,
      quantity: quote.value.quantity,
      subtotalMinor: quote.value.subtotalMinor,
      taxMinor: quote.value.taxMinor,
      totalMinor: quote.value.totalMinor,
      creditAmount: quote.value.price.creditAmount,
      billingInterval: quote.value.price.billingInterval,
      paymentConfirmed: false,
    },
  }
}

export async function createPurchaseOrder(
  store: CommerceStore,
  input: QuoteInput & { idempotencyKey: string },
): Promise<CommerceResult<{ order: OrderRecord; items: OrderItemRecord[] }>> {
  if (!input.idempotencyKey) return { ok: false, error: 'VALIDATION' }
  const quote = await resolveQuote(store, input)
  if (!quote.ok) return quote
  const existing = await store.findOrderByIdempotency(input.idempotencyKey)
  if (existing) {
    if (existing.requestFingerprint !== quote.value.requestFingerprint) return { ok: false, error: 'IDEMPOTENCY_CONFLICT' }
    return { ok: true, value: { order: existing, items: await store.listItems(existing.id) } }
  }
  const now = new Date()
  const order: OrderRecord = {
    id: id('ord'),
    publicId: id('pubord'),
    billingGroupId: input.billingGroupId,
    customerAccountId: input.customerAccountId,
    projectId: input.projectId ?? null,
    payerUserId: input.actor.userId,
    status: 'PENDING',
    currency: quote.value.price.currency,
    subtotalMinor: quote.value.subtotalMinor,
    taxMinor: quote.value.taxMinor,
    totalMinor: quote.value.totalMinor,
    idempotencyKey: input.idempotencyKey,
    requestFingerprint: quote.value.requestFingerprint,
    serviceOrderId: null,
    failureCode: null,
    createdAt: now,
    updatedAt: now,
  }
  const item: OrderItemRecord = {
    id: id('itm'),
    orderId: order.id,
    productId: quote.value.product.id,
    productPriceId: quote.value.price.id,
    productKey: quote.value.product.productKey,
    quantity: quote.value.quantity,
    unitAmountMinor: quote.value.price.amountMinor,
    currency: quote.value.price.currency,
    priceVersion: quote.value.price.priceVersion,
    creditAmount: quote.value.price.creditAmount,
    snapshot: {
      productKey: quote.value.product.productKey,
      priceVersion: quote.value.price.priceVersion,
      amountMinor: quote.value.price.amountMinor,
      creditAmount: quote.value.price.creditAmount,
    },
    createdAt: now,
  }
  await store.saveOrder(order)
  await store.replaceItems(order.id, [item])
  const serviceOrder = {
    id: id('svo'),
    publicId: id('pubsvo'),
    commerceOrderId: order.id,
    customerAccountId: input.customerAccountId ?? input.billingGroupId,
    projectId: input.projectId ?? null,
    requestedById: input.actor.userId,
    serviceKey: quote.value.product.productKey,
    status: 'REQUESTED',
    quoteAmountCents: order.totalMinor,
    quoteCurrency: order.currency,
    billingGroupId: input.billingGroupId,
    submissionFingerprint: order.requestFingerprint,
  }
  if (input.customerAccountId) {
    await store.saveServiceOrder(serviceOrder)
    order.serviceOrderId = serviceOrder.id
    await store.saveOrder(order)
  }
  if (input.projectId && input.customerAccountId) {
    await store.saveProjectService({
      id: id('psv'),
      projectId: input.projectId,
      customerAccountId: input.customerAccountId,
      commerceOrderId: order.id,
      serviceOrderId: order.serviceOrderId,
      productKey: quote.value.product.productKey,
      status: 'NOT_STARTED',
      entitlementKey: quote.value.product.entitlementKey,
      customerServiceId: null,
      createdAt: now,
      updatedAt: now,
    })
  }
  await audit(store, {
    billingGroupId: order.billingGroupId,
    actorUserId: input.actor.userId,
    action: 'ORDER_CREATED',
    entityType: 'CommerceOrder',
    entityId: order.id,
    metadata: { status: order.status, totalMinor: order.totalMinor },
  })
  return { ok: true, value: { order, items: [item] } }
}

export async function createCheckout(
  store: CommerceStore,
  input: { actor: CommerceActor; orderId: string; idempotencyKey: string; providerKey?: string | null },
): Promise<CommerceResult<{ checkoutId: string; status: string; externalCheckoutRef: string | null; paymentConfirmed: false }>> {
  const order = await store.findOrder(input.orderId)
  if (!order) return { ok: false, error: 'ORDER_NOT_FOUND' }
  const payer = await authorizePayer(store, input.actor, order.billingGroupId, order.customerAccountId, new Date(), 'SERVICE')
  if (!payer.ok) return payer
  if (order.payerUserId && order.payerUserId !== input.actor.userId && payer.ok) {
    const role = await store.findBillingRole(order.billingGroupId, input.actor.userId)
    if (!role || (role.role !== 'GROUP_OWNER' && role.role !== 'BILLING_ADMIN')) return { ok: false, error: 'FORBIDDEN' }
  }
  const existing = await store.findCheckoutByIdempotency(input.idempotencyKey)
  if (existing) {
    if (existing.orderId !== order.id) return { ok: false, error: 'IDEMPOTENCY_CONFLICT' }
    return {
      ok: true,
      value: {
        checkoutId: existing.id,
        status: existing.status,
        externalCheckoutRef: existing.externalCheckoutRef,
        paymentConfirmed: false,
      },
    }
  }
  if (order.status !== 'PENDING' && order.status !== 'CHECKOUT_CREATED') {
    return { ok: false, error: 'FORBIDDEN_TRANSITION' }
  }
  const provider = getBillingProvider(input.providerKey)
  const created = await provider.createCheckout({
    orderId: order.id,
    orderPublicId: order.publicId,
    amountMinor: order.totalMinor,
    currency: order.currency,
    idempotencyKey: input.idempotencyKey,
  })
  const now = new Date()
  const checkout = {
    id: id('chk'),
    publicId: id('pubchk'),
    orderId: order.id,
    providerKey: provider.key,
    status: created.ok ? ('READY' as const) : ('DISABLED' as const),
    externalCheckoutRef: created.ok ? created.value.externalCheckoutRef : null,
    expiresAt: created.ok ? created.value.expiresAt : new Date(now.getTime() + 30 * 60_000),
    idempotencyKey: input.idempotencyKey,
    failureCode: created.ok ? null : created.error,
    createdAt: now,
    updatedAt: now,
  }
  await store.saveCheckout(checkout)
  let payment = await store.findPaymentByOrder(order.id)
  if (!payment) {
    payment = {
      id: id('pay'),
      publicId: id('pubpay'),
      orderId: order.id,
      billingGroupId: order.billingGroupId,
      customerAccountId: order.customerAccountId,
      providerKey: provider.key,
      externalPaymentRef: null,
      status: 'PENDING',
      amountMinor: order.totalMinor,
      currency: order.currency,
      lastEventSequence: 0,
      idempotencyKey: `pay:${order.id}`,
      capturedAt: null,
      failureCode: null,
      createdAt: now,
      updatedAt: now,
    }
    await store.savePayment(payment)
  }
  if (created.ok && canTransitionOrder(order.status, 'CHECKOUT_CREATED')) {
    order.status = 'CHECKOUT_CREATED'
    order.updatedAt = now
    await store.saveOrder(order)
  }
  await audit(store, {
    billingGroupId: order.billingGroupId,
    actorUserId: input.actor.userId,
    action: 'CHECKOUT_CREATED',
    entityType: 'CommerceCheckoutIntent',
    entityId: checkout.id,
    metadata: { providerKey: provider.key, status: checkout.status, paymentConfirmed: false },
  })
  return {
    ok: true,
    value: {
      checkoutId: checkout.id,
      status: checkout.status,
      externalCheckoutRef: checkout.externalCheckoutRef,
      paymentConfirmed: false,
    },
  }
}

export async function rejectBrowserPaymentConfirmation(): Promise<CommerceResult<never>> {
  return { ok: false, error: 'REDIRECT_NOT_CONFIRMATION', message: 'Browser return is not payment confirmation' }
}

export { cancelUnpaidOrder } from '@/lib/platform/commerce/lifecycle'
export { buildCommerceReconciliationReport } from '@/lib/platform/commerce/reconciliation-report'

async function authorizeOrderRead(store: CommerceStore, actor: CommerceActor, order: OrderRecord): Promise<boolean> {
  if (isStaff(actor)) return true
  const role = await store.findBillingRole(order.billingGroupId, actor.userId)
  if (role) return true
  if (order.customerAccountId && (await store.hasOperatingMembership(actor.userId, order.customerAccountId))) return true
  return false
}

export function toFinancialOrderDto(order: OrderRecord, items: OrderItemRecord[]): FinancialOrderDto {
  return {
    id: order.id,
    publicId: order.publicId,
    billingGroupId: order.billingGroupId,
    customerAccountId: order.customerAccountId,
    projectId: order.projectId,
    status: order.status,
    currency: order.currency,
    subtotalMinor: order.subtotalMinor,
    taxMinor: order.taxMinor,
    totalMinor: order.totalMinor,
    items: items.map((item) => ({
      productKey: item.productKey,
      quantity: item.quantity,
      unitAmountMinor: item.unitAmountMinor,
      currency: item.currency,
      priceVersion: item.priceVersion,
      creditAmount: item.creditAmount,
    })),
  }
}

export async function getFinancialOrder(store: CommerceStore, actor: CommerceActor, orderId: string) {
  const order = await store.findOrder(orderId)
  if (!order) return { ok: false as const, error: 'ORDER_NOT_FOUND' as const }
  if (!(await authorizeOrderRead(store, actor, order))) return { ok: false as const, error: 'FORBIDDEN' as const }
  return { ok: true as const, value: toFinancialOrderDto(order, await store.listItems(order.id)) }
}

export async function listAccountServices(store: CommerceStore, actor: CommerceActor, customerAccountId: string, billingGroupId?: string) {
  if (!isStaff(actor)) {
    const operating = await store.hasOperatingMembership(actor.userId, customerAccountId)
    let groupAllowed = false
    if (billingGroupId) {
      const role = await store.findBillingRole(billingGroupId, actor.userId)
      const memberships = await store.listFundingMemberships(billingGroupId, customerAccountId)
      groupAllowed = Boolean(role) && memberships.length > 0
    }
    if (!operating && !groupAllowed) return { ok: false as const, error: 'FORBIDDEN' as const }
  }
  const services = await store.listProjectServicesByAccount(customerAccountId)
  return {
    ok: true as const,
    value: services.map((service) => ({
      id: service.id,
      projectId: service.projectId,
      customerAccountId: service.customerAccountId,
      productKey: service.productKey,
      status: service.status,
      commerceOrderId: service.commerceOrderId,
    })),
  }
}

export async function listGroupOrders(store: CommerceStore, actor: CommerceActor, billingGroupId: string) {
  if (!isStaff(actor)) {
    const role = await store.findBillingRole(billingGroupId, actor.userId)
    if (!role) return { ok: false as const, error: 'FORBIDDEN' as const }
  }
  const orders = await store.listOrdersByGroup(billingGroupId)
  const dtos = []
  for (const order of orders) dtos.push(toFinancialOrderDto(order, await store.listItems(order.id)))
  return { ok: true as const, value: dtos }
}

async function defaultMint(externalPaymentRef: string) {
  const { prisma } = await import('@/lib/db')
  const result = await mintCreditsFromFundingEvidence(prisma, externalPaymentRef)
  if (!result.ok) return { ok: false as const, error: result.error }
  return { ok: true as const, value: { ledgerEntryId: result.value.ledgerEntryId, replay: result.value.replay } }
}

export async function executeFulfillment(
  store: CommerceStore,
  orderId: string,
  deps?: { mint?: CreditMintPort },
): Promise<CommerceResult<FulfillmentRecord>> {
  if (!isCommerceFulfillmentEnabled()) return { ok: false, error: 'NOT_CONFIGURED' }
  const order = await store.findOrder(orderId)
  if (!order) return { ok: false, error: 'ORDER_NOT_FOUND' }
  const existingFulfillment = await store.findFulfillmentByOrder(order.id)
  if (existingFulfillment?.status === 'COMPLETED') return { ok: true, value: existingFulfillment }
  if (order.status !== 'PAID' && order.status !== 'FULFILLMENT_PENDING' && order.status !== 'FULFILLMENT_BLOCKED') {
    return { ok: false, error: 'PAYMENT_NOT_CONFIRMED' }
  }
  const items = await store.listItems(order.id)
  const item = items[0]
  if (!item) return { ok: false, error: 'VALIDATION' }
  const product = await store.findProduct(item.productId)
  if (!product) return { ok: false, error: 'PRICE_UNAVAILABLE' }
  const walletBoundary = assertFulfillmentDoesNotDebitWallet(product, false)
  if (!walletBoundary.ok) return walletBoundary
  const now = new Date()
  let fulfillment = existingFulfillment
  const kind = product.creditEligible ? 'CREDIT' : 'SERVICE'
  if (!fulfillment) {
    fulfillment = {
      id: id('ful'),
      orderId: order.id,
      kind,
      status: 'PREPARED',
      idempotencyKey: `fulfill:${order.id}`,
      externalPaymentRef: null,
      walletFundingEvidenceId: null,
      ledgerEntryId: null,
      attemptCount: 0,
      lastError: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    }
    await store.saveFulfillment(fulfillment)
  }
  if (canTransitionOrder(order.status, 'FULFILLMENT_PENDING')) {
    order.status = 'FULFILLMENT_PENDING'
    order.updatedAt = now
    await store.saveOrder(order)
  }

  if (kind === 'SERVICE') {
    if (!isCommerceProvisioningEnabled()) {
      fulfillment.status = 'BLOCKED'
      fulfillment.lastError = 'PROVISIONING_DISABLED'
      fulfillment.updatedAt = now
      await store.saveFulfillment(fulfillment)
      if (canTransitionOrder(order.status, 'FULFILLMENT_BLOCKED')) {
        order.status = 'FULFILLMENT_BLOCKED'
        order.failureCode = 'PROVISIONING_DISABLED'
        order.updatedAt = now
        await store.saveOrder(order)
      }
      return { ok: false, error: 'PROVISIONING_DISABLED' }
    }
    const services = await store.listProjectServicesByOrder(order.id)
    for (const service of services) {
      service.status = 'COMPLETED'
      service.updatedAt = now
      await store.saveProjectService(service)
    }
    fulfillment.status = 'COMPLETED'
    fulfillment.completedAt = now
    fulfillment.updatedAt = now
    await store.saveFulfillment(fulfillment)
    if (canTransitionOrder(order.status, 'FULFILLED')) {
      order.status = 'FULFILLED'
      order.failureCode = null
      order.updatedAt = now
      await store.saveOrder(order)
    }
    return { ok: true, value: fulfillment }
  }

  const payment = await store.findPaymentByOrder(order.id)
  if (!payment || payment.status !== 'CAPTURED') return { ok: false, error: 'PAYMENT_NOT_CONFIRMED' }
  const externalPaymentRef = payment.externalPaymentRef ?? payment.publicId
  fulfillment.externalPaymentRef = externalPaymentRef
  const wallet = await store.findWallet(order.billingGroupId)
  if (!wallet || wallet.status !== 'ACTIVE') return { ok: false, error: 'WALLET_NOT_FOUND' }
  let funding = await store.findFundingByExternal(externalPaymentRef)
  if (!funding) {
    funding = {
      id: id('fnd'),
      billingGroupId: order.billingGroupId,
      walletId: wallet.id,
      providerKey: payment.providerKey,
      externalPaymentRef,
      creditAmount: item.creditAmount ?? 0,
      commerceOrderId: order.id,
      commercePaymentId: payment.id,
      priceVersion: item.priceVersion,
      verifiedAt: payment.capturedAt ?? now,
      ledgerEntryId: null,
    }
    if (!funding.creditAmount || funding.creditAmount <= 0) return { ok: false, error: 'PRICE_UNAVAILABLE' }
    await store.saveFunding(funding)
    fulfillment.walletFundingEvidenceId = funding.id
  }
  const mint = deps?.mint ?? defaultMint
  const minted = await mint(externalPaymentRef)
  if (!minted.ok) {
    fulfillment.status = 'BLOCKED'
    fulfillment.lastError = minted.error === 'UNAUTHORIZED_SETTLE' ? 'MINT_DISABLED' : (minted.error ?? 'MINT_DISABLED')
    fulfillment.updatedAt = now
    await store.saveFulfillment(fulfillment)
    if (canTransitionOrder(order.status, 'FULFILLMENT_BLOCKED')) {
      order.status = 'FULFILLMENT_BLOCKED'
      order.failureCode = 'MINT_DISABLED'
      order.updatedAt = now
      await store.saveOrder(order)
    }
    await audit(store, {
      billingGroupId: order.billingGroupId,
      action: 'CREDIT_MINT_BLOCKED',
      entityType: 'CommerceFulfillment',
      entityId: fulfillment.id,
      metadata: { externalPaymentRef, ledgerWritten: false },
    })
    return { ok: false, error: 'MINT_DISABLED' }
  }
  fulfillment.status = 'COMPLETED'
  fulfillment.ledgerEntryId = minted.value?.ledgerEntryId ?? null
  fulfillment.completedAt = now
  fulfillment.lastError = null
  fulfillment.updatedAt = now
  await store.saveFulfillment(fulfillment)
  if (funding && minted.value?.ledgerEntryId) {
    funding.ledgerEntryId = minted.value.ledgerEntryId
    await store.saveFunding(funding)
  }
  if (canTransitionOrder(order.status, 'FULFILLED')) {
    order.status = 'FULFILLED'
    order.failureCode = null
    order.updatedAt = now
    await store.saveOrder(order)
  }
  await audit(store, {
    billingGroupId: order.billingGroupId,
    action: 'CREDIT_MINTED',
    entityType: 'CommerceOrder',
    entityId: order.id,
    metadata: { ledgerEntryId: fulfillment.ledgerEntryId, externalPaymentRef },
  })
  return { ok: true, value: fulfillment }
}

export async function recoverFulfillment(store: CommerceStore, orderId: string, deps?: { mint?: CreditMintPort }) {
  const existing = await store.findFulfillmentByOrder(orderId)
  if (!existing) return executeFulfillment(store, orderId, deps)
  if (existing.status === 'COMPLETED') return { ok: true as const, value: existing }
  existing.attemptCount += 1
  existing.updatedAt = new Date()
  await store.saveFulfillment(existing)
  return executeFulfillment(store, orderId, deps)
}

async function ensureSubscription(store: CommerceStore, order: OrderRecord, payment: PaymentRecord, item: OrderItemRecord) {
  if (item && (await store.findPrice(item.productPriceId))?.billingInterval === 'NONE') return null
  const price = await store.findPrice(item.productPriceId)
  if (!price || price.billingInterval === 'NONE') return null
  const existing = await store.findSubscriptionByOrder(order.id)
  if (existing) return existing
  const now = new Date()
  const subscription = {
    id: id('sub'),
    publicId: id('pubsub'),
    billingGroupId: order.billingGroupId,
    customerAccountId: order.customerAccountId,
    projectId: order.projectId,
    productId: item.productId,
    productPriceId: item.productPriceId,
    orderId: order.id,
    providerKey: payment.providerKey,
    externalSubscriptionRef: null,
    status: 'INCOMPLETE' as const,
    billingInterval: price.billingInterval,
    currentPeriodStart: null,
    currentPeriodEnd: null,
    cancelAt: null,
    cancelledAt: null,
    renewalMetadata: null,
    createdAt: now,
    updatedAt: now,
  }
  await store.saveSubscription(subscription)
  return subscription
}

async function ensureInvoice(
  store: CommerceStore,
  order: OrderRecord,
  payment: PaymentRecord,
  externalInvoiceRef: string | null,
  subscriptionId: string | null,
) {
  if (externalInvoiceRef) {
    const existing = await store.findInvoiceByExternal(payment.providerKey, externalInvoiceRef)
    if (existing) return existing
  }
  const current = await store.listInvoicesByOrder(order.id)
  if (current.length > 0 && !externalInvoiceRef) return current[0]
  const now = new Date()
  const invoice = {
    id: id('inv'),
    publicId: id('pubinv'),
    billingGroupId: order.billingGroupId,
    customerAccountId: order.customerAccountId,
    orderId: order.id,
    subscriptionId,
    providerKey: payment.providerKey,
    externalInvoiceRef,
    currency: order.currency,
    amountMinor: order.totalMinor,
    taxMinor: order.taxMinor,
    status: 'ISSUED',
    issuedAt: now,
    createdAt: now,
  }
  await store.saveInvoice(invoice)
  return invoice
}

export async function ingestPaymentWebhook(
  store: CommerceStore,
  input: { providerKey: string; rawBody: string; signature: string | null },
  deps?: { mint?: CreditMintPort },
): Promise<CommerceResult<{ processingStatus: string; orderStatus?: string; duplicate?: boolean }>> {
  const provider = getBillingProvider(input.providerKey)
  const verified = await provider.verifyWebhook(input.rawBody, input.signature)
  const payloadHash = createHash('sha256').update(input.rawBody).digest('hex')
  if (!verified.ok) {
    const failed = {
      id: id('wh'),
      providerKey: input.providerKey,
      externalEventId: `invalid:${payloadHash}`,
      eventType: 'unverified',
      payloadHash,
      signatureValid: false,
      processingStatus: 'FAILED' as const,
      sequenceHint: null,
      orderId: null,
      paymentId: null,
      failureCode: verified.error,
      receivedAt: new Date(),
      processedAt: new Date(),
    }
    const prior = await store.findWebhook(failed.providerKey, failed.externalEventId)
    if (!prior) await store.saveWebhook(failed)
    return { ok: false, error: 'SIGNATURE_INVALID' }
  }
  const event = verified.value
  const prior = await store.findWebhook(provider.key, event.externalEventId)
  if (prior) {
    return { ok: true, value: { processingStatus: 'DUPLICATE', duplicate: true, orderStatus: undefined } }
  }
  let order: OrderRecord | null = null
  if (event.orderId) order = await store.findOrder(event.orderId)
  if (!order && event.checkoutRef) {
    const checkout = await store.findCheckoutByExternal(provider.key, event.checkoutRef)
    if (checkout) order = await store.findOrder(checkout.orderId)
  }
  const webhook: WebhookRecord = {
    id: id('wh'),
    providerKey: provider.key,
    externalEventId: event.externalEventId,
    eventType: event.eventType,
    payloadHash,
    signatureValid: true,
    processingStatus: 'RECEIVED',
    sequenceHint: event.sequence,
    orderId: order?.id ?? null,
    paymentId: null,
    failureCode: null,
    receivedAt: new Date(),
    processedAt: null,
  }
  if (!order) {
    webhook.processingStatus = 'FAILED'
    webhook.failureCode = 'ORDER_NOT_FOUND'
    webhook.processedAt = new Date()
    await store.saveWebhook(webhook)
    return { ok: false, error: 'ORDER_NOT_FOUND' }
  }
  const payment = await store.findPaymentByOrder(order.id)
  if (!payment) {
    webhook.processingStatus = 'FAILED'
    webhook.failureCode = 'PAYMENT_NOT_CONFIRMED'
    webhook.processedAt = new Date()
    await store.saveWebhook(webhook)
    return { ok: false, error: 'PAYMENT_NOT_CONFIRMED' }
  }
  webhook.paymentId = payment.id
  if (!isCommerceWebhookProcessingEnabled()) {
    webhook.processingStatus = 'IGNORED'
    webhook.processedAt = new Date()
    await store.saveWebhook(webhook)
    return { ok: true, value: { processingStatus: 'IGNORED', orderStatus: order.status } }
  }
  if (event.sequence < payment.lastEventSequence) {
    webhook.processingStatus = 'OUT_OF_ORDER'
    webhook.processedAt = new Date()
    await store.saveWebhook(webhook)
    await audit(store, {
      billingGroupId: order.billingGroupId,
      action: 'WEBHOOK_OUT_OF_ORDER',
      entityType: 'CommercePayment',
      entityId: payment.id,
      metadata: { sequence: event.sequence, lastEventSequence: payment.lastEventSequence },
    })
    return { ok: true, value: { processingStatus: 'OUT_OF_ORDER', orderStatus: order.status } }
  }

  const now = new Date()
  const applyPayment = async (next: PaymentRecord['status'], failureCode: string | null) => {
    if (!canTransitionPayment(payment.status, next)) {
      webhook.processingStatus = 'FAILED'
      webhook.failureCode = 'FORBIDDEN_TRANSITION'
      webhook.processedAt = now
      await store.saveWebhook(webhook)
      return false
    }
    payment.status = next
    payment.failureCode = failureCode
    payment.lastEventSequence = event.sequence
    payment.updatedAt = now
    if (next === 'CAPTURED') payment.capturedAt = now
    if (event.externalPaymentRef) payment.externalPaymentRef = event.externalPaymentRef
    await store.savePayment(payment)
    const attempts = await store.listAttempts(payment.id)
    await store.saveAttempt({
      id: id('att'),
      paymentId: payment.id,
      attemptNumber: attempts.length + 1,
      status: next,
      providerEventId: event.externalEventId,
      failureCode,
      createdAt: now,
    })
    return true
  }

  if (event.eventType === 'payment.captured') {
    if (event.amountMinor !== order.totalMinor || (event.currency && event.currency !== order.currency)) {
      webhook.processingStatus = 'FAILED'
      webhook.failureCode = 'PRICE_MISMATCH'
      webhook.processedAt = now
      await store.saveWebhook(webhook)
      return { ok: false, error: 'PRICE_MISMATCH' }
    }
    const lateCaptureAfterCancel = order.status === 'CANCELLED'
    const applied = await applyPayment('CAPTURED', null)
    if (!applied) return { ok: false, error: 'FORBIDDEN_TRANSITION' }
    if (canTransitionOrder(order.status, 'PAID')) {
      order.status = 'PAID'
      order.failureCode = lateCaptureAfterCancel ? 'LATE_CAPTURE_AFTER_CANCEL' : null
      order.updatedAt = now
      await store.saveOrder(order)
    }
    const items = await store.listItems(order.id)

    if (lateCaptureAfterCancel) {
      await ensureInvoice(store, order, payment, event.externalInvoiceRef ?? null, null)
      webhook.processingStatus = 'PROCESSED'
      webhook.processedAt = now
      await store.saveWebhook(webhook)
      await audit(store, {
        billingGroupId: order.billingGroupId,
        action: 'LATE_CAPTURE_AFTER_CANCEL',
        entityType: 'CommerceOrder',
        entityId: order.id,
        metadata: {
          paymentId: payment.id,
          externalEventId: event.externalEventId,
          retainedForReconciliation: true,
          fulfillmentSkipped: true,
          subscriptionSkipped: true,
          workflowSkipped: true,
        },
      })
      await audit(store, {
        billingGroupId: order.billingGroupId,
        action: 'PAYMENT_CAPTURED',
        entityType: 'CommercePayment',
        entityId: payment.id,
        metadata: { source: 'webhook', browserRedirect: false, lateCaptureAfterCancel: true },
      })
      const fresh = await store.findOrder(order.id)
      return { ok: true, value: { processingStatus: 'PROCESSED', orderStatus: fresh?.status ?? order.status } }
    }

    const subscription = items[0] ? await ensureSubscription(store, order, payment, items[0]) : null
    await ensureInvoice(store, order, payment, event.externalInvoiceRef ?? null, subscription?.id ?? null)
    webhook.processingStatus = 'PROCESSED'
    webhook.processedAt = now
    await store.saveWebhook(webhook)
    await audit(store, {
      billingGroupId: order.billingGroupId,
      action: 'PAYMENT_CAPTURED',
      entityType: 'CommercePayment',
      entityId: payment.id,
      metadata: { source: 'webhook', browserRedirect: false },
    })
    if (isCommerceFulfillmentEnabled()) {
      await executeFulfillment(store, order.id, deps)
    }
    const { enqueueCommercePreparation } = await import('@/lib/platform/commerce/workflow')
    const queued = await enqueueCommercePreparation({
      orderId: order.id,
      billingGroupId: order.billingGroupId,
      customerAccountId: order.customerAccountId,
      kind: productKindFor(items[0]),
    })
    await audit(store, {
      billingGroupId: order.billingGroupId,
      action: 'WORKFLOW_PREPARE',
      entityType: 'CommerceOrder',
      entityId: order.id,
      metadata: { queued: queued.ok, error: queued.ok ? null : queued.error },
    })
    const fresh = await store.findOrder(order.id)
    return { ok: true, value: { processingStatus: 'PROCESSED', orderStatus: fresh?.status ?? order.status } }
  }

  if (event.eventType === 'payment.failed') {
    const applied = await applyPayment('FAILED', 'PAYMENT_FAILED')
    if (!applied) return { ok: false, error: 'FORBIDDEN_TRANSITION' }
    if (canTransitionOrder(order.status, 'FAILED')) {
      order.status = 'FAILED'
      order.failureCode = 'PAYMENT_FAILED'
      order.updatedAt = now
      await store.saveOrder(order)
    }
    webhook.processingStatus = 'PROCESSED'
    webhook.processedAt = now
    await store.saveWebhook(webhook)
    return { ok: true, value: { processingStatus: 'PROCESSED', orderStatus: order.status } }
  }

  if (event.eventType === 'payment.refunded') {
    const applied = await applyPayment('REFUNDED', null)
    if (!applied) return { ok: false, error: 'FORBIDDEN_TRANSITION' }
    if (canTransitionOrder(order.status, 'REFUNDED')) {
      order.status = 'REFUNDED'
      order.updatedAt = now
      await store.saveOrder(order)
    }
    const fulfillment = await store.findFulfillmentByOrder(order.id)
    if (fulfillment?.ledgerEntryId) {
      await audit(store, {
        billingGroupId: order.billingGroupId,
        action: 'COMPENSATING_REFUND_REVIEW',
        entityType: 'CommerceOrder',
        entityId: order.id,
        metadata: { ledgerEntryId: fulfillment.ledgerEntryId, walletRefundRequiresActivation: true },
      })
    }
    webhook.processingStatus = 'PROCESSED'
    webhook.processedAt = now
    await store.saveWebhook(webhook)
    return { ok: true, value: { processingStatus: 'PROCESSED', orderStatus: order.status } }
  }

  if (event.eventType.startsWith('subscription.')) {
    const subscription = (await store.findSubscriptionByOrder(order.id)) ?? (await ensureSubscriptionFromEvent(store, order, payment))
    if (!subscription) {
      webhook.processingStatus = 'FAILED'
      webhook.failureCode = 'NOT_CONFIGURED'
      webhook.processedAt = now
      await store.saveWebhook(webhook)
      return { ok: false, error: 'NOT_CONFIGURED' }
    }
    const next =
      event.eventType === 'subscription.activated'
        ? 'ACTIVE'
        : event.eventType === 'subscription.past_due'
          ? 'PAST_DUE'
          : event.eventType === 'subscription.cancelled'
            ? 'CANCELLED'
            : null
    if (!next || !canTransitionSubscription(subscription.status, next)) {
      webhook.processingStatus = 'FAILED'
      webhook.failureCode = 'FORBIDDEN_TRANSITION'
      webhook.processedAt = now
      await store.saveWebhook(webhook)
      return { ok: false, error: 'FORBIDDEN_TRANSITION' }
    }
    subscription.status = next
    if (event.externalSubscriptionRef) subscription.externalSubscriptionRef = event.externalSubscriptionRef
    if (event.periodStart) subscription.currentPeriodStart = new Date(event.periodStart)
    if (event.periodEnd) subscription.currentPeriodEnd = new Date(event.periodEnd)
    subscription.renewalMetadata = {
      eventType: event.eventType,
      sequence: event.sequence,
      periodStart: event.periodStart ?? null,
      periodEnd: event.periodEnd ?? null,
    }
    if (next === 'CANCELLED') subscription.cancelledAt = now
    subscription.updatedAt = now
    await store.saveSubscription(subscription)
    webhook.processingStatus = 'PROCESSED'
    webhook.processedAt = now
    await store.saveWebhook(webhook)
    return { ok: true, value: { processingStatus: 'PROCESSED', orderStatus: order.status } }
  }

  webhook.processingStatus = 'FAILED'
  webhook.failureCode = 'VALIDATION'
  webhook.processedAt = now
  await store.saveWebhook(webhook)
  return { ok: false, error: 'VALIDATION' }
}

function productKindFor(item: OrderItemRecord | undefined): 'CREDIT' | 'SERVICE' {
  return item?.creditAmount ? 'CREDIT' : 'SERVICE'
}

async function ensureSubscriptionFromEvent(store: CommerceStore, order: OrderRecord, payment: PaymentRecord) {
  const items = await store.listItems(order.id)
  if (!items[0]) return null
  return ensureSubscription(store, order, payment, items[0])
}

export async function requestSubscriptionCancellation(
  store: CommerceStore,
  input: { actor: CommerceActor; subscriptionId: string },
) {
  const subscription = await store.findSubscription(input.subscriptionId)
  if (!subscription) return { ok: false as const, error: 'ORDER_NOT_FOUND' as const }
  const payer = await authorizePayer(store, input.actor, subscription.billingGroupId, subscription.customerAccountId, new Date(), 'SERVICE')
  if (!payer.ok) return payer
  const provider = getBillingProvider(subscription.providerKey)
  const remote = await provider.cancelSubscription({
    externalSubscriptionRef: subscription.externalSubscriptionRef ?? subscription.publicId,
  })
  if (!canTransitionSubscription(subscription.status, 'CANCEL_SCHEDULED')) {
    return { ok: false as const, error: 'FORBIDDEN_TRANSITION' as const }
  }
  subscription.status = 'CANCEL_SCHEDULED'
  subscription.cancelAt = new Date()
  subscription.updatedAt = new Date()
  await store.saveSubscription(subscription)
  await audit(store, {
    billingGroupId: subscription.billingGroupId,
    actorUserId: input.actor.userId,
    action: 'SUBSCRIPTION_CANCEL_REQUESTED',
    entityType: 'CommerceSubscription',
    entityId: subscription.id,
    metadata: { providerCancelled: remote.ok, providerError: remote.ok ? null : remote.error },
  })
  return { ok: true as const, value: { status: subscription.status, providerCancelled: false as const } }
}

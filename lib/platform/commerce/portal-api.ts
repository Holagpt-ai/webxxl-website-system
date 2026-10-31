import {
  isCommerceBackendEnabled,
  isCommerceCheckoutEnabled,
} from '@/config/commerce-backend'
import { isWalletBackendEnabled, isWalletGroupReadEnabled } from '@/config/wallet-backend'
import { prisma } from '@/lib/db'
import type {
  AdminCatalogProductDto,
  BillingGroupSummaryDto,
  LegacyMarketplaceLinkDto,
  MarketplaceRequestHistoryDto,
  PurchaseHistoryOrderDto,
  WalletSummaryDto,
} from '@/lib/platform/commerce/dto'
import { buildCommerceReconciliationReport, toFinancialOrderDto } from '@/lib/platform/commerce/engine'
import type { CommerceReconciliationReport } from '@/lib/platform/commerce/reconciliation-report'
import type { PageParams, PageResult } from '@/lib/platform/commerce/pagination'
import { pageResult } from '@/lib/platform/commerce/pagination'
import type { CommerceStore } from '@/lib/platform/commerce/store'
import type { ActivationStatus, CommerceActor, CommerceResult, OrderRecord } from '@/lib/platform/commerce/types'
import { getGroupWallet, getWalletBalance } from '@/lib/platform/wallet/durable-service'

function isStaff(actor: CommerceActor): boolean {
  return actor.platformRole === 'ADMIN' || actor.platformRole === 'STAFF'
}

function paymentConfirmedStatus(status: OrderRecord['status']): boolean {
  return status === 'PAID' || status === 'FULFILLMENT_PENDING' || status === 'FULFILLED' || status === 'FULFILLMENT_BLOCKED' || status === 'REFUNDED'
}

async function legacyLinkForOrder(
  store: CommerceStore,
  order: OrderRecord,
): Promise<LegacyMarketplaceLinkDto | null> {
  if (!order.serviceOrderId) return null
  const link = await store.findServiceOrderByCommerceOrder(order.id)
  if (!link) return null
  return {
    serviceOrderId: link.id,
    publicId: link.publicId,
    serviceKey: link.serviceKey,
    status: link.status,
    quoteAmountCents: link.quoteAmountCents,
    quoteCurrency: link.quoteCurrency,
  }
}

async function toPurchaseHistoryDto(store: CommerceStore, order: OrderRecord): Promise<PurchaseHistoryOrderDto> {
  const items = await store.listItems(order.id)
  const base = toFinancialOrderDto(order, items)
  return {
    ...base,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    legacyMarketplace: await legacyLinkForOrder(store, order),
    checkoutEnabled: false,
    paymentConfirmed: paymentConfirmedStatus(order.status),
  }
}

async function assertAccountAccess(
  store: CommerceStore,
  actor: CommerceActor,
  customerAccountId: string,
): Promise<CommerceResult<true>> {
  if (isStaff(actor)) return { ok: true, value: true }
  if (await store.hasOperatingMembership(actor.userId, customerAccountId)) return { ok: true, value: true }
  return { ok: false, error: 'FORBIDDEN' }
}

async function assertBillingGroupReader(
  store: CommerceStore,
  actor: CommerceActor,
  billingGroupId: string,
): Promise<CommerceResult<{ role: 'GROUP_OWNER' | 'BILLING_ADMIN' | 'BILLING_VIEWER' | null }>> {
  const group = await store.findBillingGroup(billingGroupId)
  if (!group || group.status !== 'ACTIVE') return { ok: false, error: 'ACCOUNT_NOT_FUNDED' }
  if (isStaff(actor)) return { ok: true, value: { role: null } }
  const role = await store.findBillingRole(billingGroupId, actor.userId)
  if (role) return { ok: true, value: { role: role.role } }
  const members = await store.listBillingGroupMembers(billingGroupId)
  for (const member of members) {
    if (!(await store.hasOperatingMembership(actor.userId, member.customerAccountId))) continue
    const funding = await store.listFundingMemberships(billingGroupId, member.customerAccountId)
    if (funding.some((row) => row.status === 'ACTIVE')) {
      return { ok: true, value: { role: null } }
    }
  }
  return { ok: false, error: 'FORBIDDEN' }
}

export async function listCustomerPurchaseHistory(
  store: CommerceStore,
  actor: CommerceActor,
  input: { customerAccountId: string; billingGroupId?: string | null; page: PageParams },
): Promise<CommerceResult<PageResult<PurchaseHistoryOrderDto>>> {
  const access = await assertAccountAccess(store, actor, input.customerAccountId)
  if (!access.ok) return access
  if (input.billingGroupId) {
    const memberships = await store.listFundingMemberships(input.billingGroupId, input.customerAccountId)
    if (memberships.length === 0 && !isStaff(actor)) return { ok: false, error: 'FORBIDDEN' }
  }
  const total = await store.countOrdersForAccount(input.customerAccountId, input.billingGroupId ?? null)
  const rows = await store.listOrdersForAccountPage(
    input.customerAccountId,
    input.billingGroupId ?? null,
    input.page.skip,
    input.page.take,
  )
  const items: PurchaseHistoryOrderDto[] = []
  for (const order of rows) {
    if (!isStaff(actor)) {
      const allowed =
        order.customerAccountId === input.customerAccountId &&
        (!input.billingGroupId || order.billingGroupId === input.billingGroupId)
      if (!allowed) continue
    }
    items.push(await toPurchaseHistoryDto(store, order))
  }
  return { ok: true, value: pageResult(items, total, input.page) }
}

export async function listBillingGroupPurchaseHistory(
  store: CommerceStore,
  actor: CommerceActor,
  input: { billingGroupId: string; customerAccountId?: string | null; page: PageParams },
): Promise<CommerceResult<PageResult<PurchaseHistoryOrderDto>>> {
  const reader = await assertBillingGroupReader(store, actor, input.billingGroupId)
  if (!reader.ok) return reader
  if (input.customerAccountId && !isStaff(actor) && !reader.value.role) {
    const operating = await store.hasOperatingMembership(actor.userId, input.customerAccountId)
    if (!operating) return { ok: false, error: 'FORBIDDEN' }
  }
  if (input.customerAccountId && reader.value.role) {
    const memberships = await store.listFundingMemberships(input.billingGroupId, input.customerAccountId)
    if (memberships.length === 0) return { ok: false, error: 'TENANT_MISMATCH' }
  }
  const total = await store.countOrdersForGroup(input.billingGroupId, input.customerAccountId ?? null)
  const rows = await store.listOrdersForGroupPage(
    input.billingGroupId,
    input.customerAccountId ?? null,
    input.page.skip,
    input.page.take,
  )
  const items: PurchaseHistoryOrderDto[] = []
  for (const order of rows) items.push(await toPurchaseHistoryDto(store, order))
  return { ok: true, value: pageResult(items, total, input.page) }
}

export async function getBillingGroupSummary(
  store: CommerceStore,
  actor: CommerceActor,
  billingGroupId: string,
): Promise<CommerceResult<BillingGroupSummaryDto>> {
  const reader = await assertBillingGroupReader(store, actor, billingGroupId)
  if (!reader.ok) return reader
  const group = await store.findBillingGroup(billingGroupId)
  if (!group) return { ok: false, error: 'ACCOUNT_NOT_FUNDED' }

  const allMembers = await store.listBillingGroupMembers(billingGroupId)
  let memberAccounts = allMembers
  if (!isStaff(actor) && !reader.value.role) {
    const operatingIds = new Set<string>()
    for (const member of allMembers) {
      if (await store.hasOperatingMembership(actor.userId, member.customerAccountId)) {
        operatingIds.add(member.customerAccountId)
      }
    }
    if (operatingIds.size === 0) return { ok: false, error: 'FORBIDDEN' }
    memberAccounts = allMembers.filter((m) => operatingIds.has(m.customerAccountId))
  }

  return {
    ok: true,
    value: {
      id: group.id,
      name: group.name,
      slug: group.slug,
      status: group.status,
      defaultCurrency: group.defaultCurrency,
      callerRole: reader.value.role,
      memberAccounts: memberAccounts.map((m) => ({
        customerAccountId: m.customerAccountId,
        businessName: m.businessName,
        slug: m.slug,
        fundingStatus: m.status,
        walletUseAllowed: m.walletUseAllowed,
      })),
      commerceBackendEnabled: isCommerceBackendEnabled(),
      walletBackendEnabled: isWalletBackendEnabled(),
      walletGroupReadEnabled: isWalletGroupReadEnabled(),
      checkoutEnabled: false,
    },
  }
}

export async function getBillingGroupWalletSummary(
  store: CommerceStore,
  actor: CommerceActor,
  billingGroupId: string,
): Promise<CommerceResult<WalletSummaryDto>> {
  const reader = await assertBillingGroupReader(store, actor, billingGroupId)
  if (!reader.ok) return reader
  if (!isStaff(actor) && reader.value.role === 'BILLING_VIEWER') {
    // viewers may read balance
  } else if (!isStaff(actor) && !reader.value.role) {
    return { ok: false, error: 'FORBIDDEN' }
  }

  const base: WalletSummaryDto = {
    billingGroupId,
    walletId: null,
    creditType: 'MESSAGING',
    unit: 'CREDITS',
    postedBalance: null,
    reservedBalance: null,
    availableBalance: null,
    walletBackendEnabled: isWalletBackendEnabled(),
    walletGroupReadEnabled: isWalletGroupReadEnabled(),
    readDisabledReason: null,
  }

  if (!isWalletBackendEnabled()) {
    return { ok: true, value: { ...base, readDisabledReason: 'WALLET_DISABLED' } }
  }
  if (!isWalletGroupReadEnabled() && !isStaff(actor)) {
    return { ok: true, value: { ...base, readDisabledReason: 'WALLET_READ_DISABLED' } }
  }

  const wallet = await getGroupWallet(prisma, billingGroupId)
  if (!wallet) return { ok: true, value: base }
  const balance = await getWalletBalance(prisma, wallet.id)
  if (!balance) return { ok: true, value: { ...base, walletId: wallet.id } }
  return {
    ok: true,
    value: {
      ...base,
      walletId: wallet.id,
      postedBalance: balance.postedBalance,
      reservedBalance: balance.reservedBalance,
      availableBalance: balance.availableBalance,
    },
  }
}

export async function listAdminCatalog(
  store: CommerceStore,
  actor: CommerceActor,
): Promise<CommerceResult<AdminCatalogProductDto[]>> {
  if (!isStaff(actor)) return { ok: false, error: 'FORBIDDEN' }
  const products = await store.listProducts()
  const rows: AdminCatalogProductDto[] = []
  for (const product of products) {
    const prices = await store.listPrices(product.id)
    rows.push({
      productKey: product.productKey,
      publicId: product.publicId,
      name: product.name,
      kind: product.kind,
      status: product.status,
      pricingMode: product.pricingMode,
      purchasable: product.purchasable,
      eligibilityCohort: product.eligibilityCohort,
      entitlementKey: product.entitlementKey,
      creditEligible: product.creditEligible,
      prices: prices.map((price) => ({
        id: price.id,
        publicId: price.publicId,
        currency: price.currency,
        amountMinor: price.amountMinor,
        billingInterval: price.billingInterval,
        priceVersion: price.priceVersion,
        status: price.status,
        creditAmount: price.creditAmount,
        effectiveFrom: price.effectiveFrom.toISOString(),
        effectiveTo: price.effectiveTo?.toISOString() ?? null,
      })),
    })
  }
  return { ok: true, value: rows }
}

function open001Protected(product: { pricingMode: string; eligibilityCohort: string; kind: string }): boolean {
  return (
    product.pricingMode === 'INCLUDED_FREE' ||
    product.eligibilityCohort === 'UNRESOLVED' ||
    product.kind === 'AI_WORKFORCE'
  )
}

export async function setProductActivationStatus(
  store: CommerceStore,
  actor: CommerceActor,
  productKey: string,
  status: ActivationStatus,
): Promise<CommerceResult<{ productKey: string; status: ActivationStatus }>> {
  if (!isStaff(actor)) return { ok: false, error: 'FORBIDDEN' }
  const product = await store.findProductByKey(productKey)
  if (!product) return { ok: false, error: 'PRICE_UNAVAILABLE' }
  if (open001Protected(product) && status === 'ACTIVE') {
    return { ok: false, error: 'POLICY_UNRESOLVED' }
  }
  if (product.kind === 'AI_WORKFORCE' && status === 'ACTIVE') {
    return { ok: false, error: 'NOT_CONFIGURED' }
  }
  product.status = status
  product.updatedAt = new Date()
  await store.saveProduct(product)
  await store.appendAudit({
    id: `aud_${Date.now()}`,
    billingGroupId: null,
    actorUserId: actor.userId,
    action: 'PRODUCT_STATUS_UPDATED',
    entityType: 'CommerceProduct',
    entityId: product.id,
    metadata: { productKey, status },
    createdAt: new Date(),
  })
  return { ok: true, value: { productKey, status } }
}

export async function setPriceActivationStatus(
  store: CommerceStore,
  actor: CommerceActor,
  priceId: string,
  status: ActivationStatus,
): Promise<CommerceResult<{ priceId: string; status: ActivationStatus }>> {
  if (!isStaff(actor)) return { ok: false, error: 'FORBIDDEN' }
  if (status === 'DRAFT') return { ok: false, error: 'VALIDATION' }
  const price = await store.findPrice(priceId)
  if (!price) return { ok: false, error: 'PRICE_UNAVAILABLE' }
  const product = await store.findProduct(price.productId)
  if (!product) return { ok: false, error: 'PRICE_UNAVAILABLE' }
  if (open001Protected(product) && status === 'ACTIVE') {
    return { ok: false, error: 'POLICY_UNRESOLVED' }
  }
  price.status = status
  price.updatedAt = new Date()
  await store.savePrice(price)
  await store.appendAudit({
    id: `aud_${Date.now()}`,
    billingGroupId: null,
    actorUserId: actor.userId,
    action: 'PRICE_STATUS_UPDATED',
    entityType: 'CommerceProductPrice',
    entityId: price.id,
    metadata: { priceId, status, productKey: product.productKey },
    createdAt: new Date(),
  })
  return { ok: true, value: { priceId, status } }
}

export async function listMarketplaceRequestHistory(
  store: CommerceStore,
  actor: CommerceActor,
  input: { customerAccountId: string; page: PageParams },
): Promise<CommerceResult<PageResult<MarketplaceRequestHistoryDto>>> {
  const access = await assertAccountAccess(store, actor, input.customerAccountId)
  if (!access.ok) return access

  const where = { customerAccountId: input.customerAccountId }
  const total = await prisma.serviceOrder.count({ where })
  const serviceOrders = await prisma.serviceOrder.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    skip: input.page.skip,
    take: input.page.take,
    select: {
      id: true,
      publicId: true,
      serviceKey: true,
      status: true,
      customerNotes: true,
      quoteAmountCents: true,
      quoteCurrency: true,
      projectId: true,
      createdAt: true,
      updatedAt: true,
    },
  })
  const commerceByService = await prisma.commerceOrder.findMany({
    where: { serviceOrderId: { in: serviceOrders.map((row) => row.id) } },
    select: { id: true, publicId: true, status: true, serviceOrderId: true },
  })
  const commerceMap = new Map(commerceByService.map((row) => [row.serviceOrderId!, row]))

  const items: MarketplaceRequestHistoryDto[] = serviceOrders.map((row) => {
    const commerce = commerceMap.get(row.id)
    return {
      serviceOrderId: row.id,
      publicId: row.publicId,
      serviceKey: row.serviceKey,
      status: row.status,
      customerNotes: row.customerNotes,
      quoteAmountCents: row.quoteAmountCents,
      quoteCurrency: row.quoteCurrency,
      projectId: row.projectId,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      commerceOrder: commerce
        ? { id: commerce.id, publicId: commerce.publicId, status: commerce.status }
        : null,
    }
  })

  return { ok: true, value: pageResult(items, total, input.page) }
}

export async function getAdminCommerceReconciliationReport(
  store: CommerceStore,
  actor: CommerceActor,
  billingGroupId: string,
  limit?: number,
): Promise<CommerceResult<CommerceReconciliationReport>> {
  if (!isStaff(actor)) {
    const role = await store.findBillingRole(billingGroupId, actor.userId)
    if (!role || role.role === 'BILLING_VIEWER') return { ok: false, error: 'FORBIDDEN' }
  }
  return buildCommerceReconciliationReport(store, billingGroupId, limit)
}

export function commerceFeatureFlagsForClient() {
  return {
    commerceBackendEnabled: isCommerceBackendEnabled(),
    commerceCheckoutEnabled: isCommerceCheckoutEnabled(),
    checkoutEnabled: false as const,
  }
}

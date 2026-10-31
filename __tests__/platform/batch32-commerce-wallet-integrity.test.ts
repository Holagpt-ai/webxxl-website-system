import { afterEach, describe, expect, it } from 'vitest'
import {
  isCommerceBackendEnabled,
  isCommerceLiveProviderEnabled,
  isCommerceWalletMintEnabled,
} from '@/config/commerce-backend'
import { isWalletBackendEnabled } from '@/config/wallet-backend'
import {
  BILLING_PAYER_OPERATIONAL_ISOLATION,
  classifyFinancialInstrument,
} from '@/lib/platform/commerce/financial-boundaries'
import {
  buildCommerceReconciliationReport,
  cancelUnpaidOrder,
  configureProductPrice,
  createCheckout,
  createPurchaseOrder,
  ensureCatalogSkeleton,
  executeFulfillment,
  ingestPaymentWebhook,
  listGroupOrders,
  quotePurchase,
  type CreditMintPort,
} from '@/lib/platform/commerce/engine'
import { createMemoryCommerceStore } from '@/lib/platform/commerce/memory-store'
import { signCommerceWebhook } from '@/lib/platform/commerce/providers'
import type { FundingMembership } from '@/lib/platform/billing-authz'
import {
  ABMED_AESTHETICS_ACCOUNT_ID,
  ABMED_CLINICAL_ACCOUNT_ID,
  ABMED_GROUP_ID,
  ABMED_PHYSICIANS_ACCOUNT_ID,
  ABMED_WALLET_ID,
  BILLING_OWNER_USER_ID,
  CLINICAL_ONLY_USER_ID,
} from '@/lib/platform/fixtures/abmed'
import { listWalletReservationReviewItems } from '@/lib/platform/wallet/reservation-reconciliation'
import { reserveCredits } from '@/lib/platform/wallet/durable-service'
import { createMemoryWalletPrisma } from '@/lib/platform/wallet/test/memory-wallet-prisma'
import { seedSyntheticWalletTopUpForTests } from '@/lib/platform/wallet/test/synthetic-funding'
import { enableWalletDurableTestExecution } from '@/lib/platform/wallet/test/wallet-test-execution'

const ENV_KEYS = [
  'COMMERCE_BACKEND_ENABLED',
  'COMMERCE_CHECKOUT_ENABLED',
  'COMMERCE_LIVE_PROVIDER_ENABLED',
  'COMMERCE_WALLET_MINT_ENABLED',
  'COMMERCE_FULFILLMENT_ENABLED',
  'COMMERCE_PROVISIONING_ENABLED',
  'COMMERCE_WEBHOOK_PROCESSING_ENABLED',
  'COMMERCE_PROVIDER_MODE',
  'COMMERCE_MOCK_WEBHOOK_SECRET',
  'WALLET_BACKEND_ENABLED',
  'WALLET_RESERVATION_ENABLED',
  'WALLET_TEST_EXECUTION_BYPASS',
]

const payer = { userId: BILLING_OWNER_USER_ID, platformRole: 'CUSTOMER' as const }
const clinical = { userId: CLINICAL_ONLY_USER_ID, platformRole: 'CUSTOMER' as const }
const admin = { userId: 'user_staff_admin', platformRole: 'ADMIN' as const }
const from = new Date('2020-01-01T00:00:00.000Z')

function commerceStore() {
  return createMemoryCommerceStore({
    billingGroups: [{ id: ABMED_GROUP_ID, name: 'ABMED Group', slug: 'abmed', status: 'ACTIVE', defaultCurrency: 'USD' }],
    roles: [{ billingGroupId: ABMED_GROUP_ID, userId: BILLING_OWNER_USER_ID, role: 'GROUP_OWNER' }],
    memberships: [ABMED_AESTHETICS_ACCOUNT_ID, ABMED_PHYSICIANS_ACCOUNT_ID, ABMED_CLINICAL_ACCOUNT_ID].map(
      (customerAccountId): FundingMembership => ({
        billingGroupId: ABMED_GROUP_ID,
        customerAccountId,
        status: 'ACTIVE',
        validFrom: from,
        validTo: null,
        walletUseAllowed: true,
      }),
    ),
    operating: [{ userId: CLINICAL_ONLY_USER_ID, customerAccountId: ABMED_CLINICAL_ACCOUNT_ID }],
    policies: [{ billingGroupId: ABMED_GROUP_ID, customerAccountId: ABMED_PHYSICIANS_ACCOUNT_ID, groupHardCap: 0 }],
    projects: [{ id: 'project_aesthetics', customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID }],
    wallets: [{ id: ABMED_WALLET_ID, billingGroupId: ABMED_GROUP_ID, status: 'ACTIVE' }],
  })
}

function enableMockCommerce() {
  process.env.COMMERCE_CHECKOUT_ENABLED = 'true'
  process.env.COMMERCE_PROVIDER_MODE = 'mock'
  process.env.COMMERCE_MOCK_WEBHOOK_SECRET = 'test-only-mock-secret'
  process.env.COMMERCE_WEBHOOK_PROCESSING_ENABLED = 'true'
  process.env.COMMERCE_FULFILLMENT_ENABLED = 'true'
}

async function creditPrice(db: ReturnType<typeof commerceStore>) {
  await ensureCatalogSkeleton(db)
  const priced = await configureProductPrice(db, {
    actor: admin,
    productKey: 'messaging.credits',
    currency: 'USD',
    amountMinor: 2500,
    billingInterval: 'NONE',
    priceVersion: 'batch32-credits-v1',
    creditAmount: 500,
    effectiveFrom: from,
    providerKey: 'mock',
    externalPriceRef: null,
  })
  if (!priced.ok) throw new Error(priced.error)
  return priced.value
}

afterEach(() => {
  for (const key of ENV_KEYS) delete process.env[key]
})

describe('Batch 32 — commerce, wallet & fulfillment integrity', () => {
  it('keeps live commerce, wallet mint, and providers disabled by default', () => {
    expect(isCommerceBackendEnabled()).toBe(false)
    expect(isCommerceWalletMintEnabled()).toBe(false)
    expect(isCommerceLiveProviderEnabled()).toBe(false)
    expect(isWalletBackendEnabled()).toBe(false)
  })

  it('classifies money, wallet credits, and included FREE instruments', async () => {
    const db = commerceStore()
    await ensureCatalogSkeleton(db)
    const crm = await db.findProductByKey('crm.included')
    const credits = await db.findProductByKey('messaging.credits')
    const domain = await db.findProductByKey('domain.registration')
    expect(crm && classifyFinancialInstrument(crm)).toBe('INCLUDED_FREE_SOFTWARE')
    expect(credits && classifyFinancialInstrument(credits)).toBe('MESSAGING_WALLET_CREDITS')
    expect(domain && classifyFinancialInstrument(domain)).toBe('MONEY_PURCHASE')
    expect(BILLING_PAYER_OPERATIONAL_ISOLATION).toContain('does not grant')
  })

  it('funds multiple CustomerAccounts under one BillingGroup payer without CRM leakage', async () => {
    const db = commerceStore()
    const price = await creditPrice(db)
    for (const [accountId, key] of [
      [ABMED_AESTHETICS_ACCOUNT_ID, 'b32-aes'],
      [ABMED_CLINICAL_ACCOUNT_ID, 'b32-cli'],
    ] as const) {
      const created = await createPurchaseOrder(db, {
        actor: payer,
        billingGroupId: ABMED_GROUP_ID,
        customerAccountId: accountId,
        productPriceId: price.id,
        quantity: 1,
        expectedTotalMinor: 2500,
        currency: 'USD',
        idempotencyKey: key,
      })
      expect(created.ok).toBe(true)
    }
    const groupOrders = await listGroupOrders(db, payer, ABMED_GROUP_ID)
    expect(groupOrders.ok).toBe(true)
    if (groupOrders.ok) {
      const accounts = new Set(groupOrders.value.map((row) => row.customerAccountId))
      expect(accounts.has(ABMED_AESTHETICS_ACCOUNT_ID)).toBe(true)
      expect(accounts.has(ABMED_CLINICAL_ACCOUNT_ID)).toBe(true)
      expect(JSON.stringify(groupOrders.value)).not.toMatch(/contact|conversation|campaign/i)
    }
    const denied = await listGroupOrders(db, clinical, ABMED_GROUP_ID)
    expect(denied.ok).toBe(false)
  })

  it('blocks fulfillment before verified payment and supports unpaid cancellation', async () => {
    const db = commerceStore()
    const price = await creditPrice(db)
    const created = await createPurchaseOrder(db, {
      actor: payer,
      billingGroupId: ABMED_GROUP_ID,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      productPriceId: price.id,
      quantity: 1,
      expectedTotalMinor: 2500,
      currency: 'USD',
      idempotencyKey: 'b32-unpaid',
    })
    if (!created.ok) throw new Error(created.error)
    const early = await executeFulfillment(db, created.value.order.id)
    expect(early.ok).toBe(false)
    const cancelled = await cancelUnpaidOrder(db, { actor: payer, orderId: created.value.order.id })
    expect(cancelled.ok).toBe(true)
    const order = await db.findOrder(created.value.order.id)
    expect(order?.status).toBe('CANCELLED')
  })

  it('requires verified webhook capture before fulfillment and dedupes replay', async () => {
    const db = commerceStore()
    const price = await creditPrice(db)
    enableMockCommerce()
    const created = await createPurchaseOrder(db, {
      actor: payer,
      billingGroupId: ABMED_GROUP_ID,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      productPriceId: price.id,
      quantity: 1,
      expectedTotalMinor: 2500,
      currency: 'USD',
      idempotencyKey: 'b32-capture',
    })
    if (!created.ok) throw new Error(created.error)
    await createCheckout(db, { actor: payer, orderId: created.value.order.id, idempotencyKey: 'b32-chk', providerKey: 'mock' })
    const mint: CreditMintPort = async () => ({ ok: false, error: 'UNAUTHORIZED_SETTLE' })
    const body = JSON.stringify({
      id: 'b32_evt_1',
      eventType: 'payment.captured',
      sequence: 1,
      orderId: created.value.order.id,
      amountMinor: 2500,
      currency: 'USD',
      externalPaymentRef: 'b32_pay',
    })
    const signature = signCommerceWebhook(body, 'test-only-mock-secret')
    const first = await ingestPaymentWebhook(db, { providerKey: 'mock', rawBody: body, signature }, { mint })
    expect(first.ok).toBe(true)
    const replay = await ingestPaymentWebhook(db, { providerKey: 'mock', rawBody: body, signature }, { mint })
    expect(replay.ok).toBe(true)
    if (replay.ok) expect(replay.value.duplicate).toBe(true)
    const hostingPrice = await configureProductPrice(db, {
      actor: admin,
      productKey: 'website.hosting',
      currency: 'USD',
      amountMinor: 4900,
      billingInterval: 'MONTH',
      priceVersion: 'batch32-host-v1',
      effectiveFrom: from,
      providerKey: 'mock',
      externalPriceRef: null,
    })
    if (!hostingPrice.ok) throw new Error(hostingPrice.error)
    const subOrder = await createPurchaseOrder(db, {
      actor: payer,
      billingGroupId: ABMED_GROUP_ID,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      productPriceId: hostingPrice.value.id,
      quantity: 1,
      expectedTotalMinor: 4900,
      currency: 'USD',
      idempotencyKey: 'b32-sub',
    })
    if (!subOrder.ok) throw new Error(subOrder.error)
    await createCheckout(db, { actor: payer, orderId: subOrder.value.order.id, idempotencyKey: 'b32-chk-sub', providerKey: 'mock' })
    const subBody = JSON.stringify({
      id: 'b32_evt_sub',
      eventType: 'payment.captured',
      sequence: 1,
      orderId: subOrder.value.order.id,
      amountMinor: 4900,
      currency: 'USD',
      externalPaymentRef: 'b32_pay_sub',
    })
    await ingestPaymentWebhook(
      db,
      { providerKey: 'mock', rawBody: subBody, signature: signCommerceWebhook(subBody, 'test-only-mock-secret') },
      { mint },
    )
    const incomplete = await db.findSubscriptionByOrder(subOrder.value.order.id)
    expect(incomplete?.status).toBe('INCOMPLETE')
    const subActivated = JSON.stringify({
      id: 'b32_evt_sub_active',
      eventType: 'subscription.activated',
      sequence: 2,
      orderId: subOrder.value.order.id,
      externalSubscriptionRef: 'b32_sub_ref',
    })
    await ingestPaymentWebhook(
      db,
      { providerKey: 'mock', rawBody: subActivated, signature: signCommerceWebhook(subActivated, 'test-only-mock-secret') },
      { mint },
    )
    const subscription = await db.findSubscriptionByOrder(subOrder.value.order.id)
    expect(subscription?.status).toBe('ACTIVE')
  })

  it('reports paid-without-fulfillment and funding-without-ledger in bounded reconciliation', async () => {
    const db = commerceStore()
    enableMockCommerce()
    const price = await creditPrice(db)
    const created = await createPurchaseOrder(db, {
      actor: payer,
      billingGroupId: ABMED_GROUP_ID,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      productPriceId: price.id,
      quantity: 1,
      expectedTotalMinor: 2500,
      currency: 'USD',
      idempotencyKey: 'b32-recon',
    })
    if (!created.ok) throw new Error(created.error)
    await createCheckout(db, { actor: payer, orderId: created.value.order.id, idempotencyKey: 'b32-chk2', providerKey: 'mock' })
    const body = JSON.stringify({
      id: 'b32_evt_recon',
      eventType: 'payment.captured',
      sequence: 1,
      orderId: created.value.order.id,
      amountMinor: 2500,
      currency: 'USD',
      externalPaymentRef: 'b32_pay_recon',
    })
    await ingestPaymentWebhook(
      db,
      { providerKey: 'mock', rawBody: body, signature: signCommerceWebhook(body, 'test-only-mock-secret') },
      { mint: async () => ({ ok: false, error: 'UNAUTHORIZED_SETTLE' }) },
    )
    const report = await buildCommerceReconciliationReport(db, ABMED_GROUP_ID, 10)
    expect(report.ok).toBe(true)
    if (report.ok) {
      expect(report.value.bounded).toBe(true)
      expect(report.value.activation.correctiveMutationsEnabled).toBe(false)
      expect(report.value.groupReconciliationComplete).toBe(true)
      expect(report.value.scanCoverage.ordersScanComplete).toBe(true)
      expect(report.value.findings.some((f) => f.code === 'PAID_WITHOUT_FULFILLMENT' || f.code === 'FUNDING_WITHOUT_LEDGER')).toBe(true)
    }
  })

  it('prevents concurrent wallet reservations from overspending shared balance', async () => {
    enableWalletDurableTestExecution()
    process.env.WALLET_BACKEND_ENABLED = 'true'
    process.env.WALLET_SYNTHETIC_FUNDING_ENABLED = 'true'
    const { prisma } = createMemoryWalletPrisma({
      billingGroupId: ABMED_GROUP_ID,
      walletId: ABMED_WALLET_ID,
      memberships: [ABMED_AESTHETICS_ACCOUNT_ID].map((customerAccountId) => ({
        billingGroupId: ABMED_GROUP_ID,
        customerAccountId,
        status: 'ACTIVE',
        validFrom: from,
        validTo: null,
        walletUseAllowed: true,
      })),
      policies: [
        {
          billingGroupId: ABMED_GROUP_ID,
          customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
          maxCampaignCredits: 1000,
          dailyLimit: null,
          monthlyLimit: null,
          allowedChannels: ['SMS'],
        },
      ],
    })
    const funded = await seedSyntheticWalletTopUpForTests(prisma, {
      billingGroupId: ABMED_GROUP_ID,
      amount: 100,
      idempotencyKey: 'b32_fund',
      principal: { kind: 'SERVICE', serviceId: 'wallet-settlement' },
    })
    expect(funded.ok).toBe(true)
    const base = {
      principal: { kind: 'SERVICE' as const, serviceId: 'wallet-reservation' as const },
      billingGroupId: ABMED_GROUP_ID,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      amount: 80,
      channel: 'SMS',
      correlationId: 'b32_race',
      expiresAt: new Date(Date.now() + 3600_000),
      at: new Date(),
    }
    const first = await reserveCredits(prisma, { ...base, idempotencyKey: 'b32_a' })
    expect(first.ok).toBe(true)
    const second = await reserveCredits(prisma, { ...base, idempotencyKey: 'b32_b' })
    expect(second.ok).toBe(false)
    if (!second.ok) expect(second.error).toBe('INSUFFICIENT_CREDITS')
    const review = await listWalletReservationReviewItems(prisma, ABMED_WALLET_ID, 10)
    expect(review.length).toBeGreaterThan(0)
  })

  it('rejects included FREE CRM/Marketing/SEO purchases and keeps domain orders off wallet debits', async () => {
    const db = commerceStore()
    await ensureCatalogSkeleton(db)
    for (const productKey of ['crm.included', 'marketing.included', 'seo.included'] as const) {
      const quote = await quotePurchase(db, {
        actor: payer,
        billingGroupId: ABMED_GROUP_ID,
        customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
        productKey,
        quantity: 1,
        expectedTotalMinor: 0,
        currency: 'USD',
      })
      expect(quote.ok).toBe(false)
    }
    const priced = await configureProductPrice(db, {
      actor: admin,
      productKey: 'domain.registration',
      currency: 'USD',
      amountMinor: 1800,
      billingInterval: 'NONE',
      priceVersion: 'batch32-domain-v1',
      effectiveFrom: from,
    })
    if (!priced.ok) throw new Error(priced.error)
    enableMockCommerce()
    const created = await createPurchaseOrder(db, {
      actor: payer,
      billingGroupId: ABMED_GROUP_ID,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      productPriceId: priced.value.id,
      quantity: 1,
      expectedTotalMinor: 1800,
      currency: 'USD',
      idempotencyKey: 'b32-domain',
    })
    if (!created.ok) throw new Error(created.error)
    expect(db.funding).toHaveLength(0)
  })
})

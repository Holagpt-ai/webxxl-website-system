import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  assertFulfillmentDoesNotDebitWallet,
  classifyFinancialInstrument,
} from '@/lib/platform/commerce/financial-boundaries'
import {
  configureProductPrice,
  createCheckout,
  createPurchaseOrder,
  ensureCatalogSkeleton,
  executeFulfillment,
  ingestPaymentWebhook,
} from '@/lib/platform/commerce/engine'
import { createMemoryCommerceStore } from '@/lib/platform/commerce/memory-store'
import { signCommerceWebhook } from '@/lib/platform/commerce/providers'
import { COMMERCE_CATALOG_SKELETON } from '@/lib/platform/commerce/catalog'
import type { FundingMembership } from '@/lib/platform/billing-authz'
import type { PortalUser } from '@/lib/portal/authz'
import {
  ABMED_AESTHETICS_ACCOUNT_ID,
  ABMED_CLINICAL_ACCOUNT_ID,
  ABMED_GROUP_ID,
  ABMED_PHYSICIANS_ACCOUNT_ID,
  ABMED_WALLET_ID,
  BILLING_OWNER_USER_ID,
  CLINICAL_ONLY_USER_ID,
} from '@/lib/platform/fixtures/abmed'
import {
  assertPaymentEvidenceBeforeFulfillment,
  resolveManagedServiceLifecycle,
} from '@/lib/platform/commerce-execution/managed-service-lifecycle'
import { buildPaymentProviderReadiness } from '@/lib/platform/commerce-execution/payment-readiness'
import { getCommerceExecutionSummary } from '@/lib/platform/commerce-execution/service'
import { COMMERCE_EXECUTION_BATCH_VERSION } from '@/lib/platform/commerce-execution/constants'

vi.mock('@/lib/db', () => ({
  prisma: {
    managedSite: { findFirst: vi.fn(async () => null) },
    billingGroupMembership: { findFirst: vi.fn(async () => null) },
    creditWallet: { findUnique: vi.fn(async () => null) },
  },
}))

vi.mock('@/lib/platform/open001/load-subscriber-evidence', () => ({
  loadSubscriberEvidenceForAccount: vi.fn(async (customerAccountId: string) => ({
    customerAccountId,
    subscriptions: [{ customerAccountId, productKey: 'website.subscription', status: 'ACTIVE' }],
    legacyWebsiteServices: [],
    loadOutcome: 'ok' as const,
  })),
}))

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
]

const payer = { userId: BILLING_OWNER_USER_ID, platformRole: 'CUSTOMER' as const }
const admin = { userId: 'user_staff_admin', platformRole: 'ADMIN' as const }
const from = new Date('2020-01-01T00:00:00.000Z')

function commerceStore() {
  return createMemoryCommerceStore({
    billingGroups: [{ id: ABMED_GROUP_ID, name: 'ABMED Group', slug: 'abmed', status: 'ACTIVE', defaultCurrency: 'USD' }],
    accounts: [
      { id: ABMED_AESTHETICS_ACCOUNT_ID, businessName: 'ABMED Aesthetics', slug: 'abmed-aesthetics' },
      { id: ABMED_PHYSICIANS_ACCOUNT_ID, businessName: 'ABMED Physicians Group', slug: 'abmed-physicians' },
      { id: ABMED_CLINICAL_ACCOUNT_ID, businessName: 'ABMED Clinical Research', slug: 'abmed-clinical' },
    ],
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
    operating: [
      { userId: BILLING_OWNER_USER_ID, customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID },
      { userId: BILLING_OWNER_USER_ID, customerAccountId: ABMED_PHYSICIANS_ACCOUNT_ID },
      { userId: BILLING_OWNER_USER_ID, customerAccountId: ABMED_CLINICAL_ACCOUNT_ID },
      { userId: CLINICAL_ONLY_USER_ID, customerAccountId: ABMED_CLINICAL_ACCOUNT_ID },
    ],
    policies: [],
    projects: [
      { id: 'project_aesthetics', customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID },
      { id: 'project_physicians', customerAccountId: ABMED_PHYSICIANS_ACCOUNT_ID },
      { id: 'project_clinical', customerAccountId: ABMED_CLINICAL_ACCOUNT_ID },
    ],
    wallets: [{ id: ABMED_WALLET_ID, billingGroupId: ABMED_GROUP_ID, status: 'ACTIVE' }],
  })
}

function enableMockCommerce() {
  process.env.COMMERCE_BACKEND_ENABLED = 'true'
  process.env.COMMERCE_CHECKOUT_ENABLED = 'true'
  process.env.COMMERCE_PROVIDER_MODE = 'mock'
  process.env.COMMERCE_MOCK_WEBHOOK_SECRET = 'test-only-mock-secret'
  process.env.COMMERCE_WEBHOOK_PROCESSING_ENABLED = 'true'
  process.env.COMMERCE_FULFILLMENT_ENABLED = 'true'
  process.env.COMMERCE_PROVISIONING_ENABLED = 'false'
  process.env.COMMERCE_LIVE_PROVIDER_ENABLED = 'false'
  process.env.COMMERCE_WALLET_MINT_ENABLED = 'false'
  process.env.WALLET_BACKEND_ENABLED = 'true'
}

function portalFor(accountId: string, userId = BILLING_OWNER_USER_ID): PortalUser {
  return {
    id: userId,
    email: 'billing@abmed.example',
    role: 'CUSTOMER',
    membership: { id: 'mem', role: 'OWNER', customerAccountId: accountId } as PortalUser['membership'],
    customerAccount: { id: accountId, businessName: 'ABMED', slug: 'abmed' } as PortalUser['customerAccount'],
  } as PortalUser
}

afterEach(() => {
  for (const key of ENV_KEYS) delete process.env[key]
})

describe('Batch 5 commerce & managed services', () => {
  it('preserves OPEN-001 included FREE software as non-payable and classifies money vs wallet', async () => {
    process.env.COMMERCE_BACKEND_ENABLED = 'true'
    const db = commerceStore()
    await ensureCatalogSkeleton(db)
    const crm = await db.findProductByKey('crm.included')
    const hosting = await db.findProductByKey('website.hosting')
    const credits = await db.findProductByKey('messaging.credits')
    const email = await db.findProductByKey('email.business')
    expect(crm && classifyFinancialInstrument(crm)).toBe('INCLUDED_FREE_SOFTWARE')
    expect(hosting && classifyFinancialInstrument(hosting)).toBe('MONEY_PURCHASE')
    expect(credits && classifyFinancialInstrument(credits)).toBe('MESSAGING_WALLET_CREDITS')
    expect(email && classifyFinancialInstrument(email)).toBe('MONEY_PURCHASE')
    expect(assertFulfillmentDoesNotDebitWallet(hosting!, true).ok).toBe(false)
    expect(assertFulfillmentDoesNotDebitWallet(hosting!, false).ok).toBe(true)
    expect(COMMERCE_CATALOG_SKELETON.every((row) => row.eligibilityCohort === 'SUBSCRIBER_ONLY')).toBe(true)
  })

  it('BillingGroup payer authorizes sibling-account purchases without sharing CRM isolation', async () => {
    enableMockCommerce()
    const db = commerceStore()
    await ensureCatalogSkeleton(db)
    const subPrice = await configureProductPrice(db, {
      actor: admin,
      productKey: 'website.subscription',
      currency: 'USD',
      amountMinor: 9900,
      billingInterval: 'MONTH',
      priceVersion: 'b5-sub-v1',
      effectiveFrom: from,
      providerKey: 'mock',
      externalPriceRef: null,
    })
    const domainPrice = await configureProductPrice(db, {
      actor: admin,
      productKey: 'domain.registration',
      currency: 'USD',
      amountMinor: 1500,
      billingInterval: 'NONE',
      priceVersion: 'b5-domain-v1',
      effectiveFrom: from,
      providerKey: 'mock',
      externalPriceRef: null,
    })
    const emailPrice = await configureProductPrice(db, {
      actor: admin,
      productKey: 'email.business',
      currency: 'USD',
      amountMinor: 500,
      billingInterval: 'MONTH',
      priceVersion: 'b5-email-v1',
      effectiveFrom: from,
      providerKey: 'mock',
      externalPriceRef: null,
    })
    expect(subPrice.ok && domainPrice.ok && emailPrice.ok).toBe(true)
    if (!subPrice.ok || !domainPrice.ok || !emailPrice.ok) return

    const sub = await createPurchaseOrder(db, {
      actor: payer,
      billingGroupId: ABMED_GROUP_ID,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      projectId: 'project_aesthetics',
      productPriceId: subPrice.value.id,
      quantity: 1,
      expectedTotalMinor: 9900,
      currency: 'USD',
      idempotencyKey: 'b5-aes-sub',
    })
    const domain = await createPurchaseOrder(db, {
      actor: payer,
      billingGroupId: ABMED_GROUP_ID,
      customerAccountId: ABMED_PHYSICIANS_ACCOUNT_ID,
      projectId: 'project_physicians',
      productPriceId: domainPrice.value.id,
      quantity: 1,
      expectedTotalMinor: 1500,
      currency: 'USD',
      idempotencyKey: 'b5-phy-domain',
    })
    const email = await createPurchaseOrder(db, {
      actor: payer,
      billingGroupId: ABMED_GROUP_ID,
      customerAccountId: ABMED_CLINICAL_ACCOUNT_ID,
      projectId: 'project_clinical',
      productPriceId: emailPrice.value.id,
      quantity: 1,
      expectedTotalMinor: 500,
      currency: 'USD',
      idempotencyKey: 'b5-cli-email',
    })
    expect(sub.ok && domain.ok && email.ok).toBe(true)
    if (!sub.ok || !domain.ok || !email.ok) return

    const aestheticsSummary = await getCommerceExecutionSummary({
      portal: portalFor(ABMED_AESTHETICS_ACCOUNT_ID),
      billingGroupId: ABMED_GROUP_ID,
      deps: {
        store: db,
        infrastructureOverview: async () => ({ hosting: [], domains: [], email: [] }),
        walletBalance: async () => ({ walletId: ABMED_WALLET_ID, availableBalance: 42 }),
      },
    })
    expect(aestheticsSummary.ok).toBe(true)
    if (!aestheticsSummary.ok) return
    expect(aestheticsSummary.value.batchVersion).toBe(COMMERCE_EXECUTION_BATCH_VERSION)
    expect(aestheticsSummary.value.billingGroupPayer.status).toBe('AVAILABLE')
    if (aestheticsSummary.value.billingGroupPayer.status === 'AVAILABLE') {
      expect(aestheticsSummary.value.billingGroupPayer.data.payerAuthorized).toBe(true)
      expect(aestheticsSummary.value.billingGroupPayer.data.memberAccountIds).toEqual(
        expect.arrayContaining([
          ABMED_AESTHETICS_ACCOUNT_ID,
          ABMED_PHYSICIANS_ACCOUNT_ID,
          ABMED_CLINICAL_ACCOUNT_ID,
        ]),
      )
    }
    expect(aestheticsSummary.value.walletInstrumentBoundary.status).toBe('AVAILABLE')
    if (aestheticsSummary.value.walletInstrumentBoundary.status === 'AVAILABLE') {
      expect(aestheticsSummary.value.walletInstrumentBoundary.data.moneyPurchasesDebitWallet).toBe(false)
      expect(aestheticsSummary.value.walletInstrumentBoundary.data.hostingDomainSubscriptionUseWallet).toBe(false)
      expect(aestheticsSummary.value.walletInstrumentBoundary.data.availableCredits).toBe(42)
    }
    expect(aestheticsSummary.value.purchaseHistory.status).toBe('AVAILABLE')
    if (aestheticsSummary.value.purchaseHistory.status === 'AVAILABLE') {
      expect(aestheticsSummary.value.purchaseHistory.data.orders).toHaveLength(1)
      expect(aestheticsSummary.value.purchaseHistory.data.orders[0]?.productKeys).toContain('website.subscription')
      expect(aestheticsSummary.value.purchaseHistory.data.isolationBoundary).toBe('CUSTOMER_ACCOUNT')
    }

    const physiciansSummary = await getCommerceExecutionSummary({
      portal: portalFor(ABMED_PHYSICIANS_ACCOUNT_ID),
      billingGroupId: ABMED_GROUP_ID,
      deps: {
        store: db,
        infrastructureOverview: async () => ({ hosting: [], domains: [], email: [] }),
        walletBalance: async () => ({ walletId: ABMED_WALLET_ID, availableBalance: 42 }),
      },
    })
    expect(physiciansSummary.ok).toBe(true)
    if (!physiciansSummary.ok) return
    if (physiciansSummary.value.purchaseHistory.status === 'AVAILABLE') {
      expect(physiciansSummary.value.purchaseHistory.data.orders).toHaveLength(1)
      expect(physiciansSummary.value.purchaseHistory.data.orders[0]?.productKeys).toContain('domain.registration')
    }
  })

  it('keeps quote/price-version immutable and rejects duplicate checkout/webhook idempotently', async () => {
    enableMockCommerce()
    const db = commerceStore()
    await ensureCatalogSkeleton(db)
    const priced = await configureProductPrice(db, {
      actor: admin,
      productKey: 'website.hosting',
      currency: 'USD',
      amountMinor: 2900,
      billingInterval: 'MONTH',
      priceVersion: 'b5-host-v1',
      effectiveFrom: from,
      providerKey: 'mock',
      externalPriceRef: null,
    })
    expect(priced.ok).toBe(true)
    if (!priced.ok) return
    const created = await createPurchaseOrder(db, {
      actor: payer,
      billingGroupId: ABMED_GROUP_ID,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      projectId: 'project_aesthetics',
      productPriceId: priced.value.id,
      quantity: 1,
      expectedTotalMinor: 2900,
      currency: 'USD',
      idempotencyKey: 'b5-host-order',
    })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    const items = await db.listItems(created.value.order.id)
    expect(items[0]?.priceVersion).toBe('b5-host-v1')
    expect(items[0]?.unitAmountMinor).toBe(2900)

    const firstCheckout = await createCheckout(db, {
      actor: payer,
      orderId: created.value.order.id,
      idempotencyKey: 'b5-host-chk',
      providerKey: 'mock',
    })
    const secondCheckout = await createCheckout(db, {
      actor: payer,
      orderId: created.value.order.id,
      idempotencyKey: 'b5-host-chk',
      providerKey: 'mock',
    })
    expect(firstCheckout.ok && secondCheckout.ok).toBe(true)
    if (!firstCheckout.ok || !secondCheckout.ok) return
    expect(secondCheckout.value.checkoutId).toBe(firstCheckout.value.checkoutId)

    const body = JSON.stringify({
      externalEventId: 'evt_b5_host_1',
      eventType: 'payment.captured',
      sequence: 1,
      orderId: created.value.order.id,
      checkoutRef: firstCheckout.value.externalCheckoutRef,
      amountMinor: 2900,
      currency: 'USD',
      externalPaymentRef: 'pay_b5_host_1',
    })
    const signature = signCommerceWebhook(body, 'test-only-mock-secret')
    const first = await ingestPaymentWebhook(db, { providerKey: 'mock', rawBody: body, signature })
    const second = await ingestPaymentWebhook(db, { providerKey: 'mock', rawBody: body, signature })
    expect(first.ok).toBe(true)
    expect(second.ok).toBe(true)
  })

  it('blocks fulfillment without CAPTURED payment and never pretends provider ACTIVE without evidence', async () => {
    enableMockCommerce()
    const db = commerceStore()
    await ensureCatalogSkeleton(db)
    const priced = await configureProductPrice(db, {
      actor: admin,
      productKey: 'domain.registration',
      currency: 'USD',
      amountMinor: 1200,
      billingInterval: 'NONE',
      priceVersion: 'b5-dom-v2',
      effectiveFrom: from,
      providerKey: 'mock',
      externalPriceRef: null,
    })
    expect(priced.ok).toBe(true)
    if (!priced.ok) return
    const created = await createPurchaseOrder(db, {
      actor: payer,
      billingGroupId: ABMED_GROUP_ID,
      customerAccountId: ABMED_PHYSICIANS_ACCOUNT_ID,
      projectId: 'project_physicians',
      productPriceId: priced.value.id,
      quantity: 1,
      expectedTotalMinor: 1200,
      currency: 'USD',
      idempotencyKey: 'b5-dom-unpaid',
    })
    expect(created.ok).toBe(true)
    if (!created.ok) return

    expect(
      assertPaymentEvidenceBeforeFulfillment({
        paymentStatus: null,
        orderStatus: created.value.order.status,
      }).ok,
    ).toBe(false)

    const blocked = await executeFulfillment(db, created.value.order.id)
    expect(blocked.ok).toBe(false)

    const requested = resolveManagedServiceLifecycle({
      serviceKey: 'svc_domain_1',
      productKey: 'domain.registration',
      customerAccountId: ABMED_PHYSICIANS_ACCOUNT_ID,
      orderStatus: 'PENDING',
      paymentStatus: null,
      provisioningEnabled: false,
    })
    expect(requested.lifecycle).toBe('REQUESTED')
    expect(requested.providerActivated).toBe(false)

    const ready = resolveManagedServiceLifecycle({
      serviceKey: 'svc_domain_2',
      productKey: 'domain.registration',
      customerAccountId: ABMED_PHYSICIANS_ACCOUNT_ID,
      orderStatus: 'PAID',
      paymentStatus: 'CAPTURED',
      fulfillmentStatus: 'BLOCKED',
      provisioningEnabled: false,
    })
    expect(ready.lifecycle).toBe('READY_FOR_PROVISIONING')
    expect(ready.providerActivated).toBe(false)

    const manualActive = resolveManagedServiceLifecycle({
      serviceKey: 'dom_manual',
      productKey: 'domain.registration',
      customerAccountId: ABMED_PHYSICIANS_ACCOUNT_ID,
      infraStatus: 'ACTIVE',
      dataSource: 'MANUAL',
      externalProviderRef: null,
      provisioningEnabled: false,
    })
    expect(manualActive.lifecycle).not.toBe('ACTIVE')
    expect(manualActive.providerActivated).toBe(false)

    const verified = resolveManagedServiceLifecycle({
      serviceKey: 'dom_verified',
      productKey: 'domain.registration',
      customerAccountId: ABMED_PHYSICIANS_ACCOUNT_ID,
      infraStatus: 'ACTIVE',
      dataSource: 'PROVIDER_VERIFIED',
      externalProviderRef: 'ext_domain_1',
      provisioningEnabled: true,
    })
    expect(verified.lifecycle).toBe('ACTIVE')
    expect(verified.providerActivated).toBe(true)

    const cancelled = resolveManagedServiceLifecycle({
      serviceKey: 'svc_cancel',
      productKey: 'email.business',
      customerAccountId: ABMED_CLINICAL_ACCOUNT_ID,
      serviceOrderStatus: 'CANCELLED',
      provisioningEnabled: false,
    })
    expect(cancelled.lifecycle).toBe('CANCELLED')

    const failed = resolveManagedServiceLifecycle({
      serviceKey: 'svc_fail',
      productKey: 'website.hosting',
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      orderStatus: 'FAILED',
      paymentStatus: 'FAILED',
      provisioningEnabled: false,
    })
    expect(failed.lifecycle).toBe('FAILED')
  })

  it('reports payment readiness with live charge blocked and preserves historical price snapshots', async () => {
    process.env.COMMERCE_BACKEND_ENABLED = 'true'
    process.env.COMMERCE_LIVE_PROVIDER_ENABLED = 'false'
    process.env.COMMERCE_CHECKOUT_ENABLED = 'false'
    const readiness = buildPaymentProviderReadiness('stripe')
    expect(readiness.resolvedProviderKey).toBe('disabled')
    expect(readiness.liveChargeBlocked).toBe(true)
    expect(readiness.supportedProviderKeys).toContain('stripe')
    expect(readiness.supportedProviderKeys).toContain('paddle')
    expect(readiness.supportedProviderKeys).toContain('lemon_squeezy')

    enableMockCommerce()
    const db = commerceStore()
    await ensureCatalogSkeleton(db)
    const histPrice = await configureProductPrice(db, {
      actor: admin,
      productKey: 'website.hosting',
      currency: 'USD',
      amountMinor: 2900,
      billingInterval: 'MONTH',
      priceVersion: 'b5-hist-v1',
      effectiveFrom: from,
      providerKey: 'mock',
      externalPriceRef: null,
    })
    expect(histPrice.ok).toBe(true)
    if (!histPrice.ok) return
    const first = await createPurchaseOrder(db, {
      actor: payer,
      billingGroupId: ABMED_GROUP_ID,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      projectId: 'project_aesthetics',
      productPriceId: histPrice.value.id,
      quantity: 1,
      expectedTotalMinor: 2900,
      currency: 'USD',
      idempotencyKey: 'b5-hist-1',
    })
    expect(first.ok).toBe(true)
    if (!first.ok) return
    // Later catalog price changes must not mutate the order item snapshot.
    histPrice.value.amountMinor = 3900
    histPrice.value.priceVersion = 'b5-hist-v2-mutated'
    await db.savePrice(histPrice.value)
    const items = await db.listItems(first.value.order.id)
    expect(items[0]?.priceVersion).toBe('b5-hist-v1')
    expect(items[0]?.unitAmountMinor).toBe(2900)
    expect(items[0]?.snapshot).toMatchObject({ priceVersion: 'b5-hist-v1', amountMinor: 2900 })

    const summary = await getCommerceExecutionSummary({
      portal: portalFor(ABMED_AESTHETICS_ACCOUNT_ID),
      billingGroupId: ABMED_GROUP_ID,
      deps: {
        store: db,
        infrastructureOverview: async () => ({
          hosting: [
            {
              publicId: 'hst_pending',
              status: 'PENDING',
              dataSource: 'MANUAL',
              externalProviderRef: null,
            },
          ],
          domains: [],
          email: [
            {
              publicId: 'eml_pending',
              status: 'PENDING',
              dataSource: 'MANUAL',
              externalProviderRef: null,
            },
          ],
        }),
        walletBalance: async () => ({ walletId: ABMED_WALLET_ID, availableBalance: 0 }),
      },
    })
    expect(summary.ok).toBe(true)
    if (!summary.ok) return
    expect(summary.value.paymentProviderReadiness.status).toBe('AVAILABLE')
    if (summary.value.paymentProviderReadiness.status === 'AVAILABLE') {
      expect(summary.value.paymentProviderReadiness.data.liveChargeBlocked).toBe(true)
    }
    expect(summary.value.fulfillmentPolicy.status).toBe('AVAILABLE')
    if (summary.value.managedServicesLifecycle.status === 'AVAILABLE') {
      expect(
        summary.value.managedServicesLifecycle.data.services.every((row) => !row.providerActivated || row.lifecycle === 'ACTIVE'),
      ).toBe(true)
      expect(summary.value.managedServicesLifecycle.data.activeRequiresProviderEvidence).toBe(true)
    }
  })
})

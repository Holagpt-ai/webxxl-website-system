import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  isCommerceBackendEnabled,
  isCommerceLiveProviderEnabled,
  isCommerceWalletMintEnabled,
} from '@/config/commerce-backend'
import {
  configureProductPrice,
  createCheckout,
  createPurchaseOrder,
  ensureCatalogSkeleton,
  executeFulfillment,
  getFinancialOrder,
  ingestPaymentWebhook,
  listAccountServices,
  listCatalog,
  listGroupOrders,
  quotePurchase,
  recoverFulfillment,
  rejectBrowserPaymentConfirmation,
  requestSubscriptionCancellation,
  type CreditMintPort,
} from '@/lib/platform/commerce/engine'
import { createMemoryCommerceStore } from '@/lib/platform/commerce/memory-store'
import type { FundingMembership } from '@/lib/platform/billing-authz'
import { signCommerceWebhook } from '@/lib/platform/commerce/providers'
import { enqueueCommercePreparation } from '@/lib/platform/commerce/workflow'
import {
  ABMED_AESTHETICS_ACCOUNT_ID,
  ABMED_CLINICAL_ACCOUNT_ID,
  ABMED_GROUP_ID,
  ABMED_PHYSICIANS_ACCOUNT_ID,
  ABMED_WALLET_ID,
  BILLING_OWNER_USER_ID,
  CLINICAL_ONLY_USER_ID,
} from '@/lib/platform/fixtures/abmed'
import { executeCommerceWorkflow } from '@/lib/platform/workflow/handlers/commerce-fulfillment'
import type { HandlerExecutionContext } from '@/lib/platform/workflow/types'
import { getWalletBalance } from '@/lib/platform/wallet/durable-service'
import { createMemoryWalletPrisma } from '@/lib/platform/wallet/test/memory-wallet-prisma'
import { mintCreditsFromFundingEvidence } from '@/lib/platform/wallet/top-up-quote'

const ENV_KEYS = [
  'COMMERCE_BACKEND_ENABLED',
  'COMMERCE_CHECKOUT_ENABLED',
  'COMMERCE_LIVE_PROVIDER_ENABLED',
  'COMMERCE_WALLET_MINT_ENABLED',
  'COMMERCE_FULFILLMENT_ENABLED',
  'COMMERCE_PROVISIONING_ENABLED',
  'COMMERCE_SUBSCRIPTION_PROVIDER_ENABLED',
  'COMMERCE_WEBHOOK_PROCESSING_ENABLED',
  'COMMERCE_WORKFLOW_ENQUEUE_ENABLED',
  'COMMERCE_PROVIDER_MODE',
  'COMMERCE_MOCK_WEBHOOK_SECRET',
]

const payer = { userId: BILLING_OWNER_USER_ID, platformRole: 'CUSTOMER' as const }
const clinical = { userId: CLINICAL_ONLY_USER_ID, platformRole: 'CUSTOMER' as const }
const admin = { userId: 'user_staff_admin', platformRole: 'ADMIN' as const }
const from = new Date('2020-01-01T00:00:00.000Z')

function store() {
  return createMemoryCommerceStore({
    billingGroups: [
      { id: ABMED_GROUP_ID, name: 'ABMED Group', slug: 'abmed', status: 'ACTIVE', defaultCurrency: 'USD' },
    ],
    roles: [{ billingGroupId: ABMED_GROUP_ID, userId: BILLING_OWNER_USER_ID, role: 'GROUP_OWNER' }],
    memberships: [
      ABMED_AESTHETICS_ACCOUNT_ID,
      ABMED_PHYSICIANS_ACCOUNT_ID,
      ABMED_CLINICAL_ACCOUNT_ID,
      'acct_suspended',
    ].map((customerAccountId): FundingMembership => ({
      billingGroupId: ABMED_GROUP_ID,
      customerAccountId,
      status: customerAccountId === 'acct_suspended' ? 'SUSPENDED' : 'ACTIVE',
      validFrom: from,
      validTo: null,
      walletUseAllowed: true,
    })),
    operating: [{ userId: CLINICAL_ONLY_USER_ID, customerAccountId: ABMED_CLINICAL_ACCOUNT_ID }],
    policies: [{ billingGroupId: ABMED_GROUP_ID, customerAccountId: ABMED_PHYSICIANS_ACCOUNT_ID, groupHardCap: 0 }],
    projects: [
      { id: 'project_aesthetics', customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID },
      { id: 'project_clinical', customerAccountId: ABMED_CLINICAL_ACCOUNT_ID },
    ],
    wallets: [{ id: ABMED_WALLET_ID, billingGroupId: ABMED_GROUP_ID, status: 'ACTIVE' }],
  })
}

function enableMock() {
  process.env.COMMERCE_CHECKOUT_ENABLED = 'true'
  process.env.COMMERCE_PROVIDER_MODE = 'mock'
  process.env.COMMERCE_MOCK_WEBHOOK_SECRET = 'test-only-mock-secret'
  process.env.COMMERCE_WEBHOOK_PROCESSING_ENABLED = 'true'
  process.env.COMMERCE_FULFILLMENT_ENABLED = 'true'
}

afterEach(() => {
  for (const key of ENV_KEYS) delete process.env[key]
  vi.unstubAllGlobals()
})

async function creditPrice(db: ReturnType<typeof store>) {
  await ensureCatalogSkeleton(db)
  const priced = await configureProductPrice(db, {
    actor: admin,
    productKey: 'messaging.credits',
    currency: 'USD',
    amountMinor: 2500,
    billingInterval: 'NONE',
    priceVersion: 'commerce11-credits-test-v1',
    creditAmount: 500,
    effectiveFrom: from,
    providerKey: 'mock',
    externalPriceRef: null,
  })
  if (!priced.ok) throw new Error(priced.error)
  return priced.value
}

describe('COMMERCE-11 foundation', () => {
  it('keeps live commerce, minting, and providers disabled by default', () => {
    expect(isCommerceBackendEnabled()).toBe(false)
    expect(isCommerceWalletMintEnabled()).toBe(false)
    expect(isCommerceLiveProviderEnabled()).toBe(false)
  })

  it('rejects unpaid quotes for OPEN-001 services and the AI workforce SKU', async () => {
    const db = store()
    await ensureCatalogSkeleton(db)
    const crm = await quotePurchase(db, {
      actor: payer,
      billingGroupId: ABMED_GROUP_ID,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      productKey: 'crm.included',
      quantity: 1,
      expectedTotalMinor: 0,
      currency: 'USD',
    })
    expect(crm.ok).toBe(false)
    if (!crm.ok) expect(crm.error).toBe('POLICY_UNRESOLVED')
    const ai = await quotePurchase(db, {
      actor: payer,
      billingGroupId: ABMED_GROUP_ID,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      productKey: 'ai.workforce',
      quantity: 1,
      expectedTotalMinor: 0,
      currency: 'USD',
    })
    expect(ai.ok).toBe(false)
    if (!ai.ok) expect(ai.error).toBe('NOT_CONFIGURED')
    const catalog = await listCatalog(db, clinical)
    const included = catalog.find((row) => row.productKey === 'crm.included')
    expect(included?.purchasable).toBe(false)
    expect(included?.prices).toEqual([])
  })

  it('enforces payer authority, tenant isolation, spending policy, and catalog price', async () => {
    const db = store()
    const price = await creditPrice(db)
    const base = {
      billingGroupId: ABMED_GROUP_ID,
      productPriceId: price.id,
      quantity: 1,
      expectedTotalMinor: 2500,
      currency: 'USD',
      idempotencyKey: 'order-aes-1',
    }
    const outsider = await createPurchaseOrder(db, {
      ...base,
      actor: clinical,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
    })
    expect(outsider.ok).toBe(false)
    if (!outsider.ok) expect(outsider.error).toBe('FORBIDDEN')

    const siblingTarget = await createPurchaseOrder(db, {
      ...base,
      actor: payer,
      customerAccountId: 'acct_not_in_group',
      idempotencyKey: 'order-missing',
    })
    expect(siblingTarget.ok).toBe(false)
    if (!siblingTarget.ok) expect(siblingTarget.error).toBe('FORBIDDEN')

    const suspended = await createPurchaseOrder(db, {
      ...base,
      actor: payer,
      customerAccountId: 'acct_suspended',
      idempotencyKey: 'order-suspended',
    })
    expect(suspended.ok).toBe(false)
    if (!suspended.ok) expect(suspended.error).toBe('ACCOUNT_NOT_FUNDED')

    const capped = await createPurchaseOrder(db, {
      ...base,
      actor: payer,
      customerAccountId: ABMED_PHYSICIANS_ACCOUNT_ID,
      idempotencyKey: 'order-cap',
    })
    expect(capped.ok).toBe(false)
    if (!capped.ok) expect(capped.error).toBe('POLICY_CAP')

    const mismatch = await quotePurchase(db, {
      actor: payer,
      billingGroupId: ABMED_GROUP_ID,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      productPriceId: price.id,
      quantity: 1,
      expectedTotalMinor: 1,
      currency: 'USD',
    })
    expect(mismatch.ok).toBe(false)
    if (!mismatch.ok) expect(mismatch.error).toBe('PRICE_MISMATCH')

    const created = await createPurchaseOrder(db, {
      ...base,
      actor: payer,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
    })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    const replay = await createPurchaseOrder(db, {
      ...base,
      actor: payer,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
    })
    expect(replay.ok).toBe(true)
    if (replay.ok) expect(replay.value.order.id).toBe(created.value.order.id)
    const conflict = await createPurchaseOrder(db, {
      ...base,
      actor: payer,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      projectId: 'project_aesthetics',
    })
    expect(conflict.ok).toBe(false)
    if (!conflict.ok) expect(conflict.error).toBe('IDEMPOTENCY_CONFLICT')

    const clinicalRead = await getFinancialOrder(db, clinical, created.value.order.id)
    expect(clinicalRead.ok).toBe(false)
    const ownerRead = await getFinancialOrder(db, payer, created.value.order.id)
    expect(ownerRead.ok).toBe(true)
    if (ownerRead.ok) {
      expect(JSON.stringify(ownerRead.value)).not.toContain('contact')
      expect(ownerRead.value.items[0].unitAmountMinor).toBe(2500)
      expect(ownerRead.value.customerAccountId).toBe(ABMED_AESTHETICS_ACCOUNT_ID)
    }
    const clinicalServices = await listAccountServices(db, clinical, ABMED_AESTHETICS_ACCOUNT_ID, ABMED_GROUP_ID)
    expect(clinicalServices.ok).toBe(false)
  })

  it('does not confirm payment from a disabled provider or a browser redirect', async () => {
    const db = store()
    const price = await creditPrice(db)
    const created = await createPurchaseOrder(db, {
      actor: payer,
      billingGroupId: ABMED_GROUP_ID,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      productPriceId: price.id,
      quantity: 1,
      expectedTotalMinor: 2500,
      currency: 'USD',
      idempotencyKey: 'order-disabled',
    })
    if (!created.ok) throw new Error(created.error)
    const checkout = await createCheckout(db, {
      actor: payer,
      orderId: created.value.order.id,
      idempotencyKey: 'chk-disabled',
      providerKey: 'stripe',
    })
    expect(checkout.ok).toBe(true)
    if (!checkout.ok) return
    expect(checkout.value.status).toBe('DISABLED')
    expect(checkout.value.paymentConfirmed).toBe(false)
    expect(checkout.value.externalCheckoutRef).toBeNull()
    const redirect = await rejectBrowserPaymentConfirmation()
    expect(redirect.ok).toBe(false)
    if (!redirect.ok) expect(redirect.error).toBe('REDIRECT_NOT_CONFIRMATION')
    const payment = await db.findPaymentByOrder(created.value.order.id)
    expect(payment?.status).toBe('PENDING')
    const order = await db.findOrder(created.value.order.id)
    expect(order?.status).toBe('PENDING')
  })

  it('captures once from a verified webhook, blocks minting, and ignores replays and stale events', async () => {
    const db = store()
    const price = await creditPrice(db)
    enableMock()
    const created = await createPurchaseOrder(db, {
      actor: payer,
      billingGroupId: ABMED_GROUP_ID,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      productPriceId: price.id,
      quantity: 1,
      expectedTotalMinor: 2500,
      currency: 'USD',
      idempotencyKey: 'order-capture',
    })
    if (!created.ok) throw new Error(created.error)
    const checkout = await createCheckout(db, {
      actor: payer,
      orderId: created.value.order.id,
      idempotencyKey: 'chk-capture',
      providerKey: 'mock',
    })
    expect(checkout.ok).toBe(true)
    if (!checkout.ok) return
    expect(checkout.value.status).toBe('READY')
    expect(checkout.value.paymentConfirmed).toBe(false)

    const calls: string[] = []
    const mint: CreditMintPort = async (ref) => {
      calls.push(ref)
      return { ok: false, error: 'UNAUTHORIZED_SETTLE' }
    }
    const body = JSON.stringify({
      id: 'evt_capture_1',
      eventType: 'payment.captured',
      sequence: 2,
      orderId: created.value.order.id,
      amountMinor: 2500,
      currency: 'USD',
      externalPaymentRef: 'mock_pay_1',
      externalInvoiceRef: 'mock_inv_1',
    })
    const signature = signCommerceWebhook(body, 'test-only-mock-secret')
    const captured = await ingestPaymentWebhook(db, { providerKey: 'mock', rawBody: body, signature }, { mint })
    expect(captured.ok).toBe(true)
    if (captured.ok) expect(captured.value.orderStatus).toBe('FULFILLMENT_BLOCKED')
    expect(calls).toEqual(['mock_pay_1'])
    expect(db.funding).toHaveLength(1)
    expect(db.funding[0].commerceOrderId).toBe(created.value.order.id)
    expect(db.funding[0].creditAmount).toBe(500)

    const replay = await ingestPaymentWebhook(db, { providerKey: 'mock', rawBody: body, signature }, { mint })
    expect(replay.ok).toBe(true)
    if (replay.ok) expect(replay.value.duplicate).toBe(true)
    expect(calls).toHaveLength(1)
    expect(db.funding).toHaveLength(1)

    const stale = JSON.stringify({
      id: 'evt_stale_auth',
      eventType: 'payment.failed',
      sequence: 1,
      orderId: created.value.order.id,
      amountMinor: 2500,
      currency: 'USD',
    })
    const staleResult = await ingestPaymentWebhook(
      db,
      { providerKey: 'mock', rawBody: stale, signature: signCommerceWebhook(stale, 'test-only-mock-secret') },
      { mint },
    )
    expect(staleResult.ok).toBe(true)
    if (staleResult.ok) expect(staleResult.value.processingStatus).toBe('OUT_OF_ORDER')
    const payment = await db.findPaymentByOrder(created.value.order.id)
    expect(payment?.status).toBe('CAPTURED')

    const recovered = await recoverFulfillment(db, created.value.order.id, { mint })
    expect(recovered.ok).toBe(false)
    if (!recovered.ok) expect(recovered.error).toBe('MINT_DISABLED')
    expect(db.funding).toHaveLength(1)
    expect(db.fulfillments[0].attemptCount).toBe(1)
    expect(calls).toHaveLength(2)

    const queued = await enqueueCommercePreparation({
      orderId: created.value.order.id,
      billingGroupId: ABMED_GROUP_ID,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      kind: 'CREDIT',
    })
    expect(queued.ok).toBe(false)
    if (!queued.ok) expect(queued.error).toBe('NOT_CONFIGURED')
    const handler = await executeCommerceWorkflow(
      { job: { sourceId: created.value.order.id, jobKind: 'COMMERCE_CREDIT_ISSUE_PREPARE' } } as HandlerExecutionContext,
      { orderId: created.value.order.id },
    )
    expect(handler).toEqual({ outcome: 'BLOCKED', errorCode: 'NOT_CONFIGURED' })
  })

  it('fulfills a verified credit order once when minting is injected, without a second ledger write', async () => {
    const db = store()
    const price = await creditPrice(db)
    enableMock()
    const created = await createPurchaseOrder(db, {
      actor: payer,
      billingGroupId: ABMED_GROUP_ID,
      customerAccountId: ABMED_CLINICAL_ACCOUNT_ID,
      projectId: 'project_clinical',
      productPriceId: price.id,
      quantity: 1,
      expectedTotalMinor: 2500,
      currency: 'USD',
      idempotencyKey: 'order-minted',
    })
    if (!created.ok) throw new Error(created.error)
    await createCheckout(db, {
      actor: payer,
      orderId: created.value.order.id,
      idempotencyKey: 'chk-minted',
      providerKey: 'mock',
    })
    let writes = 0
    const mint: CreditMintPort = async () => {
      writes += 1
      return { ok: true, value: { ledgerEntryId: 'led_once', replay: writes > 1 } }
    }
    const body = JSON.stringify({
      id: 'evt_mint_1',
      eventType: 'payment.captured',
      sequence: 1,
      orderId: created.value.order.id,
      amountMinor: 2500,
      currency: 'USD',
      externalPaymentRef: 'mock_pay_mint',
    })
    await ingestPaymentWebhook(
      db,
      { providerKey: 'mock', rawBody: body, signature: signCommerceWebhook(body, 'test-only-mock-secret') },
      { mint },
    )
    expect(writes).toBe(1)
    const again = await executeFulfillment(db, created.value.order.id, { mint })
    expect(again.ok).toBe(true)
    expect(writes).toBe(1)
    expect(db.fulfillments[0].ledgerEntryId).toBe('led_once')
    expect(db.fulfillments[0].status).toBe('COMPLETED')
    const services = await listAccountServices(db, clinical, ABMED_CLINICAL_ACCOUNT_ID)
    expect(services.ok).toBe(true)
    if (services.ok) {
      expect(services.value).toHaveLength(1)
      expect(services.value[0].customerAccountId).toBe(ABMED_CLINICAL_ACCOUNT_ID)
    }
    const groupOrders = await listGroupOrders(db, payer, ABMED_GROUP_ID)
    expect(groupOrders.ok).toBe(true)
    if (groupOrders.ok) expect(groupOrders.value.some((order) => order.customerAccountId === ABMED_AESTHETICS_ACCOUNT_ID)).toBe(false)
  })

  it('blocks service provisioning and does not spend messaging credits on a domain order', async () => {
    const db = store()
    await ensureCatalogSkeleton(db)
    const priced = await configureProductPrice(db, {
      actor: admin,
      productKey: 'domain.registration',
      currency: 'USD',
      amountMinor: 1800,
      billingInterval: 'NONE',
      priceVersion: 'commerce11-domain-test-v1',
      effectiveFrom: from,
    })
    if (!priced.ok) throw new Error(priced.error)
    enableMock()
    const created = await createPurchaseOrder(db, {
      actor: payer,
      billingGroupId: ABMED_GROUP_ID,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      projectId: 'project_aesthetics',
      productPriceId: priced.value.id,
      quantity: 1,
      expectedTotalMinor: 1800,
      currency: 'USD',
      idempotencyKey: 'order-domain',
    })
    if (!created.ok) throw new Error(created.error)
    await createCheckout(db, { actor: payer, orderId: created.value.order.id, idempotencyKey: 'chk-domain', providerKey: 'mock' })
    const calls: string[] = []
    const body = JSON.stringify({
      id: 'evt_domain',
      eventType: 'payment.captured',
      sequence: 1,
      orderId: created.value.order.id,
      amountMinor: 1800,
      currency: 'USD',
      externalPaymentRef: 'mock_pay_domain',
    })
    const result = await ingestPaymentWebhook(
      db,
      { providerKey: 'mock', rawBody: body, signature: signCommerceWebhook(body, 'test-only-mock-secret') },
      { mint: async (ref) => { calls.push(ref); return { ok: false, error: 'UNAUTHORIZED_SETTLE' } } },
    )
    expect(result.ok).toBe(true)
    expect(calls).toEqual([])
    expect(db.funding).toHaveLength(0)
    expect(db.fulfillments[0].status).toBe('BLOCKED')
    expect(db.fulfillments[0].lastError).toBe('PROVISIONING_DISABLED')
    const projectServices = await db.listProjectServicesByAccount(ABMED_AESTHETICS_ACCOUNT_ID)
    expect(projectServices[0].customerServiceId).toBeNull()
  })

  it('moves subscriptions through incomplete, active, cancel-scheduled, and cancelled without a live provider', async () => {
    const db = store()
    await ensureCatalogSkeleton(db)
    const priced = await configureProductPrice(db, {
      actor: admin,
      productKey: 'website.subscription',
      currency: 'USD',
      amountMinor: 4000,
      billingInterval: 'MONTH',
      priceVersion: 'commerce11-sub-test-v1',
      effectiveFrom: from,
    })
    if (!priced.ok) throw new Error(priced.error)
    enableMock()
    const created = await createPurchaseOrder(db, {
      actor: payer,
      billingGroupId: ABMED_GROUP_ID,
      customerAccountId: ABMED_CLINICAL_ACCOUNT_ID,
      projectId: 'project_clinical',
      productPriceId: priced.value.id,
      quantity: 1,
      expectedTotalMinor: 4000,
      currency: 'USD',
      idempotencyKey: 'order-sub',
    })
    if (!created.ok) throw new Error(created.error)
    await createCheckout(db, { actor: payer, orderId: created.value.order.id, idempotencyKey: 'chk-sub', providerKey: 'mock' })
    const capture = JSON.stringify({
      id: 'evt_sub_pay',
      eventType: 'payment.captured',
      sequence: 1,
      orderId: created.value.order.id,
      amountMinor: 4000,
      currency: 'USD',
      externalPaymentRef: 'mock_pay_sub',
    })
    await ingestPaymentWebhook(db, {
      providerKey: 'mock',
      rawBody: capture,
      signature: signCommerceWebhook(capture, 'test-only-mock-secret'),
    })
    const incomplete = await db.findSubscriptionByOrder(created.value.order.id)
    expect(incomplete?.status).toBe('INCOMPLETE')
    const activated = JSON.stringify({
      id: 'evt_sub_active',
      eventType: 'subscription.activated',
      sequence: 2,
      orderId: created.value.order.id,
      externalSubscriptionRef: 'mock_sub_1',
      periodStart: '2026-10-01T00:00:00.000Z',
      periodEnd: '2026-11-01T00:00:00.000Z',
    })
    const activeResult = await ingestPaymentWebhook(db, {
      providerKey: 'mock',
      rawBody: activated,
      signature: signCommerceWebhook(activated, 'test-only-mock-secret'),
    })
    expect(activeResult.ok).toBe(true)
    const active = await db.findSubscriptionByOrder(created.value.order.id)
    expect(active?.status).toBe('ACTIVE')
    expect(active?.currentPeriodEnd?.toISOString()).toBe('2026-11-01T00:00:00.000Z')
    if (!active) return
    const cancel = await requestSubscriptionCancellation(db, { actor: payer, subscriptionId: active.id })
    expect(cancel.ok).toBe(true)
    if (cancel.ok) expect(cancel.value).toEqual({ status: 'CANCEL_SCHEDULED', providerCancelled: false })
    const backwards = await db.findSubscription(active.id)
    expect(backwards?.status).toBe('CANCEL_SCHEDULED')
    const ended = JSON.stringify({
      id: 'evt_sub_end',
      eventType: 'subscription.cancelled',
      sequence: 3,
      orderId: created.value.order.id,
    })
    await ingestPaymentWebhook(db, {
      providerKey: 'mock',
      rawBody: ended,
      signature: signCommerceWebhook(ended, 'test-only-mock-secret'),
    })
    const cancelled = await db.findSubscription(active.id)
    expect(cancelled?.status).toBe('CANCELLED')
  })

  it('does not call the network for a named live processor', async () => {
    const db = store()
    const price = await creditPrice(db)
    process.env.COMMERCE_CHECKOUT_ENABLED = 'true'
    process.env.COMMERCE_LIVE_PROVIDER_ENABLED = 'true'
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const created = await createPurchaseOrder(db, {
      actor: payer,
      billingGroupId: ABMED_GROUP_ID,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      productPriceId: price.id,
      quantity: 1,
      expectedTotalMinor: 2500,
      currency: 'USD',
      idempotencyKey: 'order-live',
    })
    if (!created.ok) throw new Error(created.error)
    const checkout = await createCheckout(db, {
      actor: payer,
      orderId: created.value.order.id,
      idempotencyKey: 'chk-live',
      providerKey: 'stripe',
    })
    expect(checkout.ok).toBe(true)
    if (checkout.ok) expect(checkout.value.status).toBe('DISABLED')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('mints from verified funding evidence once and refuses unverified or disabled minting', async () => {
    const { prisma, ledger, wallets } = createMemoryWalletPrisma({
      billingGroupId: ABMED_GROUP_ID,
      walletId: ABMED_WALLET_ID,
      memberships: [
        {
          billingGroupId: ABMED_GROUP_ID,
          customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
          status: 'ACTIVE',
          validFrom: from,
          validTo: null,
          walletUseAllowed: true,
        },
      ],
    })
    await prisma.walletFundingEvidence.create({
      data: {
        billingGroupId: ABMED_GROUP_ID,
        walletId: ABMED_WALLET_ID,
        providerKey: 'mock',
        externalPaymentRef: 'pay_unverified',
        creditAmount: 500,
        commerceOrderId: 'ord_unverified',
        commercePaymentId: 'pay_row',
        priceVersion: 'commerce11-credits-test-v1',
        verifiedAt: null,
      },
    })
    process.env.COMMERCE_WALLET_MINT_ENABLED = 'true'
    const unverified = await mintCreditsFromFundingEvidence(prisma, 'pay_unverified')
    expect(unverified.ok).toBe(false)
    expect(ledger).toHaveLength(0)

    await prisma.walletFundingEvidence.create({
      data: {
        billingGroupId: ABMED_GROUP_ID,
        walletId: ABMED_WALLET_ID,
        providerKey: 'mock',
        externalPaymentRef: 'pay_verified',
        creditAmount: 500,
        commerceOrderId: 'ord_verified',
        commercePaymentId: 'pay_row_2',
        priceVersion: 'commerce11-credits-test-v1',
        verifiedAt: new Date('2026-10-20T12:00:00.000Z'),
      },
    })
    delete process.env.COMMERCE_WALLET_MINT_ENABLED
    const disabled = await mintCreditsFromFundingEvidence(prisma, 'pay_verified')
    expect(disabled.ok).toBe(false)
    expect(ledger).toHaveLength(0)

    process.env.COMMERCE_WALLET_MINT_ENABLED = 'true'
    const [first, second] = await Promise.all([
      mintCreditsFromFundingEvidence(prisma, 'pay_verified'),
      mintCreditsFromFundingEvidence(prisma, 'pay_verified'),
    ])
    expect(first.ok && second.ok).toBe(true)
    expect(ledger).toHaveLength(1)
    expect(ledger[0].deltaCredits).toBe(500)
    expect(ledger[0].orderId).toBe('ord_verified')
    expect(ledger[0].type).toBe('TOP_UP')
    expect(ledger[0].idempotencyKey.startsWith('commerce-funding:')).toBe(true)
    expect(wallets[0].ledgerSequence).toBe(1)
    const balance = await getWalletBalance(prisma, ABMED_WALLET_ID)
    expect(balance?.postedBalance).toBe(500)
    expect(balance?.availableBalance).toBe(500)
  })
})

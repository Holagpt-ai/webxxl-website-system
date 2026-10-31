import { afterEach, describe, expect, it } from 'vitest'
import {
  configureProductPrice,
  createCheckout,
  createPurchaseOrder,
  cancelUnpaidOrder,
  ensureCatalogSkeleton,
  ingestPaymentWebhook,
  buildCommerceReconciliationReport,
  type CreditMintPort,
} from '@/lib/platform/commerce/engine'
import { createMemoryCommerceStore } from '@/lib/platform/commerce/memory-store'
import { signCommerceWebhook } from '@/lib/platform/commerce/providers'
import type { FundingMembership } from '@/lib/platform/billing-authz'
import {
  ABMED_AESTHETICS_ACCOUNT_ID,
  ABMED_GROUP_ID,
  ABMED_WALLET_ID,
  BILLING_OWNER_USER_ID,
} from '@/lib/platform/fixtures/abmed'

const ENV_KEYS = [
  'COMMERCE_CHECKOUT_ENABLED',
  'COMMERCE_PROVIDER_MODE',
  'COMMERCE_MOCK_WEBHOOK_SECRET',
  'COMMERCE_WEBHOOK_PROCESSING_ENABLED',
  'COMMERCE_FULFILLMENT_ENABLED',
]

const payer = { userId: BILLING_OWNER_USER_ID, platformRole: 'CUSTOMER' as const }
const admin = { userId: 'user_staff_admin', platformRole: 'ADMIN' as const }
const from = new Date('2020-01-01T00:00:00.000Z')

function store() {
  return createMemoryCommerceStore({
    billingGroups: [{ id: ABMED_GROUP_ID, name: 'ABMED', slug: 'abmed', status: 'ACTIVE', defaultCurrency: 'USD' }],
    roles: [{ billingGroupId: ABMED_GROUP_ID, userId: BILLING_OWNER_USER_ID, role: 'GROUP_OWNER' }],
    memberships: [ABMED_AESTHETICS_ACCOUNT_ID].map(
      (customerAccountId): FundingMembership => ({
        billingGroupId: ABMED_GROUP_ID,
        customerAccountId,
        status: 'ACTIVE',
        validFrom: from,
        validTo: null,
        walletUseAllowed: true,
      }),
    ),
    operating: [],
    policies: [],
    projects: [],
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

async function creditPrice(db: ReturnType<typeof store>) {
  await ensureCatalogSkeleton(db)
  const priced = await configureProductPrice(db, {
    actor: admin,
    productKey: 'messaging.credits',
    currency: 'USD',
    amountMinor: 2500,
    billingInterval: 'NONE',
    priceVersion: 'b321-credits-v1',
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

describe('Batch 32.1 — financial integrity corrections', () => {
  it('F1: idempotent cancellation and blocks provider checkout fail-closed', async () => {
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
      idempotencyKey: 'b321-provider-cancel',
    })
    if (!created.ok) throw new Error(created.error)
    await createCheckout(db, {
      actor: payer,
      orderId: created.value.order.id,
      idempotencyKey: 'b321-chk',
      providerKey: 'mock',
    })
    const blocked = await cancelUnpaidOrder(db, { actor: payer, orderId: created.value.order.id })
    expect(blocked.ok).toBe(false)
    if (!blocked.ok) expect(blocked.error).toBe('NOT_CONFIGURED')
    const order = await db.findOrder(created.value.order.id)
    expect(order?.status).not.toBe('CANCELLED')

    const pending = await createPurchaseOrder(db, {
      actor: payer,
      billingGroupId: ABMED_GROUP_ID,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      productPriceId: price.id,
      quantity: 1,
      expectedTotalMinor: 2500,
      currency: 'USD',
      idempotencyKey: 'b321-pending-cancel',
    })
    if (!pending.ok) throw new Error(pending.error)
    const first = await cancelUnpaidOrder(db, { actor: payer, orderId: pending.value.order.id })
    expect(first.ok).toBe(true)
    if (first.ok) expect(first.value.idempotent).toBe(false)
    const again = await cancelUnpaidOrder(db, { actor: payer, orderId: pending.value.order.id })
    expect(again.ok).toBe(true)
    if (again.ok) expect(again.value.idempotent).toBe(true)
  })

  it('F1-safety: late capture preserves payment evidence without fulfillment, mint, subscription, or workflow', async () => {
    const db = store()
    const price = await creditPrice(db)
    enableMock()
    const plain = await createPurchaseOrder(db, {
      actor: payer,
      billingGroupId: ABMED_GROUP_ID,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      productPriceId: price.id,
      quantity: 1,
      expectedTotalMinor: 2500,
      currency: 'USD',
      idempotencyKey: 'b321-late-plain',
    })
    if (!plain.ok) throw new Error(plain.error)
    await createCheckout(db, {
      actor: payer,
      orderId: plain.value.order.id,
      idempotencyKey: 'b321-chk-plain',
      providerKey: 'stripe',
    })
    const cancelPlain = await cancelUnpaidOrder(db, { actor: payer, orderId: plain.value.order.id })
    expect(cancelPlain.ok).toBe(true)

    let mintCalls = 0
    const mint: CreditMintPort = async () => {
      mintCalls += 1
      return { ok: false, error: 'UNAUTHORIZED_SETTLE' }
    }
    const body = JSON.stringify({
      id: 'b321_late_evt',
      eventType: 'payment.captured',
      sequence: 1,
      orderId: plain.value.order.id,
      amountMinor: 2500,
      currency: 'USD',
      externalPaymentRef: 'b321_late_pay',
      externalInvoiceRef: 'b321_late_inv',
    })
    const captured = await ingestPaymentWebhook(
      db,
      { providerKey: 'mock', rawBody: body, signature: signCommerceWebhook(body, 'test-only-mock-secret') },
      { mint },
    )
    expect(captured.ok).toBe(true)
    const order = await db.findOrder(plain.value.order.id)
    expect(order?.status).toBe('PAID')
    expect(order?.failureCode).toBe('LATE_CAPTURE_AFTER_CANCEL')
    const payment = await db.findPaymentByOrder(plain.value.order.id)
    expect(payment?.status).toBe('CAPTURED')
    expect(payment?.externalPaymentRef).toBe('b321_late_pay')
    expect(mintCalls).toBe(0)
    expect(db.fulfillments.filter((row) => row.orderId === plain.value.order.id)).toHaveLength(0)
    expect(db.funding).toHaveLength(0)
    expect(await db.findSubscriptionByOrder(plain.value.order.id)).toBeNull()
    const orderAudits = await db.listAudit('CommerceOrder', plain.value.order.id)
    expect(orderAudits.some((row) => row.action === 'LATE_CAPTURE_AFTER_CANCEL')).toBe(true)
    expect(orderAudits.some((row) => row.action === 'WORKFLOW_PREPARE')).toBe(false)
    const invoices = await db.listInvoicesByOrder(plain.value.order.id)
    expect(invoices.length).toBe(1)

    const report = await buildCommerceReconciliationReport(db, ABMED_GROUP_ID, 10)
    expect(report.ok).toBe(true)
    if (report.ok) {
      expect(report.value.findings.some((f) => f.code === 'LATE_CAPTURE_AFTER_CANCEL' && f.orderId === plain.value.order.id)).toBe(
        true,
      )
      expect(
        report.value.findings.some(
          (f) => f.code === 'PAID_WITHOUT_FULFILLMENT' && f.orderId === plain.value.order.id,
        ),
      ).toBe(false)
    }
  })

  it('F1-safety: normal verified capture still runs fulfillment and workflow audit path', async () => {
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
      idempotencyKey: 'b321-normal-cap',
    })
    if (!created.ok) throw new Error(created.error)
    await createCheckout(db, {
      actor: payer,
      orderId: created.value.order.id,
      idempotencyKey: 'b321-chk-normal',
      providerKey: 'mock',
    })
    let mintCalls = 0
    const body = JSON.stringify({
      id: 'b321_normal_evt',
      eventType: 'payment.captured',
      sequence: 1,
      orderId: created.value.order.id,
      amountMinor: 2500,
      currency: 'USD',
      externalPaymentRef: 'b321_normal_pay',
    })
    const captured = await ingestPaymentWebhook(
      db,
      { providerKey: 'mock', rawBody: body, signature: signCommerceWebhook(body, 'test-only-mock-secret') },
      {
        mint: async () => {
          mintCalls += 1
          return { ok: false, error: 'UNAUTHORIZED_SETTLE' }
        },
      },
    )
    expect(captured.ok).toBe(true)
    const order = await db.findOrder(created.value.order.id)
    expect(order?.failureCode).not.toBe('LATE_CAPTURE_AFTER_CANCEL')
    expect(db.fulfillments.some((row) => row.orderId === created.value.order.id)).toBe(true)
    expect(mintCalls).toBe(1)
    const orderAudits = await db.listAudit('CommerceOrder', created.value.order.id)
    expect(orderAudits.some((row) => row.action === 'WORKFLOW_PREPARE')).toBe(true)
    expect(orderAudits.some((row) => row.action === 'LATE_CAPTURE_AFTER_CANCEL')).toBe(false)
  })

  it('F1: refuses cancel when payment already captured', async () => {
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
      idempotencyKey: 'b321-captured-block',
    })
    if (!created.ok) throw new Error(created.error)
    await createCheckout(db, { actor: payer, orderId: created.value.order.id, idempotencyKey: 'b321-chk-cap', providerKey: 'mock' })
    const body = JSON.stringify({
      id: 'b321_cap_evt',
      eventType: 'payment.captured',
      sequence: 1,
      orderId: created.value.order.id,
      amountMinor: 2500,
      currency: 'USD',
      externalPaymentRef: 'b321_cap_pay',
    })
    await ingestPaymentWebhook(
      db,
      { providerKey: 'mock', rawBody: body, signature: signCommerceWebhook(body, 'test-only-mock-secret') },
      { mint: async () => ({ ok: false, error: 'UNAUTHORIZED_SETTLE' }) },
    )
    const cancel = await cancelUnpaidOrder(db, { actor: payer, orderId: created.value.order.id })
    expect(cancel.ok).toBe(false)
    if (!cancel.ok) expect(cancel.error).toBe('FORBIDDEN_TRANSITION')
  })

  it('F2: bounded reconciliation scan with explicit partial coverage', async () => {
    const db = store()
    await ensureCatalogSkeleton(db)
    const price = await creditPrice(db)
    for (let i = 0; i < 12; i += 1) {
      await createPurchaseOrder(db, {
        actor: payer,
        billingGroupId: ABMED_GROUP_ID,
        customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
        productPriceId: price.id,
        quantity: 1,
        expectedTotalMinor: 2500,
        currency: 'USD',
        idempotencyKey: `b321-order-${i}`,
      })
    }
    const report = await buildCommerceReconciliationReport(db, ABMED_GROUP_ID, 5, {
      orderScan: 5,
      fundingScan: 5,
      webhookScan: 5,
    })
    expect(report.ok).toBe(true)
    if (!report.ok) return
    expect(report.value.findings.length).toBeLessThanOrEqual(5)
    expect(report.value.scanCoverage.ordersInGroup).toBe(12)
    expect(report.value.scanCoverage.ordersScanned).toBe(5)
    expect(report.value.scanCoverage.ordersScanComplete).toBe(false)
    expect(report.value.groupReconciliationComplete).toBe(false)
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  configureProductPrice,
  createPurchaseOrder,
  ensureCatalogSkeleton,
} from '@/lib/platform/commerce/engine'
import { createMemoryCommerceStore } from '@/lib/platform/commerce/memory-store'
import { isCommerceBackendEnabled } from '@/config/commerce-backend'
import {
  getBillingGroupSummary,
  getBillingGroupWalletSummary,
  listAdminCatalog,
  listBillingGroupPurchaseHistory,
  listCustomerPurchaseHistory,
  setPriceActivationStatus,
  setProductActivationStatus,
} from '@/lib/platform/commerce/portal-api'
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

vi.mock('@/lib/db', () => ({
  prisma: {
    serviceOrder: {
      count: vi.fn(async () => 0),
      findMany: vi.fn(async () => []),
    },
    commerceOrder: {
      findMany: vi.fn(async () => []),
    },
  },
}))

vi.mock('@/lib/platform/wallet/durable-service', () => ({
  getGroupWallet: vi.fn(async () => ({ id: ABMED_WALLET_ID, creditType: 'MESSAGING' })),
  getWalletBalance: vi.fn(async () => ({
    walletId: ABMED_WALLET_ID,
    billingGroupId: ABMED_GROUP_ID,
    postedBalance: 900,
    reservedBalance: 100,
    availableBalance: 800,
  })),
}))

const from = new Date('2020-01-01T00:00:00.000Z')
const payer = { userId: BILLING_OWNER_USER_ID, platformRole: 'CUSTOMER' as const }
const clinical = { userId: CLINICAL_ONLY_USER_ID, platformRole: 'CUSTOMER' as const }
const staff = { userId: 'staff_1', platformRole: 'ADMIN' as const }
const page = { take: 10, skip: 0 }

function db() {
  return createMemoryCommerceStore({
    billingGroups: [
      { id: ABMED_GROUP_ID, name: 'ABMED Group', slug: 'abmed', status: 'ACTIVE', defaultCurrency: 'USD' },
    ],
    accounts: [
      { id: ABMED_AESTHETICS_ACCOUNT_ID, businessName: 'ABMED Aesthetics', slug: 'abmed-aesthetics' },
      { id: ABMED_PHYSICIANS_ACCOUNT_ID, businessName: 'ABMED Physicians', slug: 'abmed-physicians' },
      { id: ABMED_CLINICAL_ACCOUNT_ID, businessName: 'ABMED Clinical', slug: 'abmed-clinical' },
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
    operating: [{ userId: CLINICAL_ONLY_USER_ID, customerAccountId: ABMED_CLINICAL_ACCOUNT_ID }],
    policies: [],
    projects: [],
    wallets: [{ id: ABMED_WALLET_ID, billingGroupId: ABMED_GROUP_ID, status: 'ACTIVE' }],
  })
}

async function seedCreditOrder(store: ReturnType<typeof db>, accountId: string, key: string) {
  await ensureCatalogSkeleton(store)
  const price = await configureProductPrice(store, {
    actor: staff,
    productKey: 'messaging.credits',
    currency: 'USD',
    amountMinor: 2500,
    billingInterval: 'NONE',
    priceVersion: 'commerce12-v1',
    creditAmount: 500,
    effectiveFrom: from,
  })
  if (!price.ok) throw new Error(price.error)
  return createPurchaseOrder(store, {
    actor: payer,
    billingGroupId: ABMED_GROUP_ID,
    customerAccountId: accountId,
    productPriceId: price.value.id,
    quantity: 1,
    expectedTotalMinor: 2500,
    currency: 'USD',
    idempotencyKey: key,
  })
}

beforeEach(() => {
  process.env.COMMERCE_BACKEND_ENABLED = 'true'
  process.env.WALLET_BACKEND_ENABLED = 'true'
  process.env.WALLET_GROUP_READ_ENABLED = 'true'
})

afterEach(() => {
  delete process.env.COMMERCE_BACKEND_ENABLED
  delete process.env.WALLET_BACKEND_ENABLED
  delete process.env.WALLET_GROUP_READ_ENABLED
})

describe('COMMERCE-12 portal API', () => {
  it('returns paginated purchase history for authorized account only', async () => {
    const store = db()
    await seedCreditOrder(store, ABMED_AESTHETICS_ACCOUNT_ID, 'ord-aes')
    await seedCreditOrder(store, ABMED_CLINICAL_ACCOUNT_ID, 'ord-clin')
    const allowed = await listCustomerPurchaseHistory(store, clinical, {
      customerAccountId: ABMED_CLINICAL_ACCOUNT_ID,
      page,
    })
    expect(allowed.ok).toBe(true)
    if (allowed.ok) {
      expect(allowed.value.items).toHaveLength(1)
      expect(allowed.value.items[0].customerAccountId).toBe(ABMED_CLINICAL_ACCOUNT_ID)
      expect(allowed.value.items[0].checkoutEnabled).toBe(false)
    }
    const denied = await listCustomerPurchaseHistory(store, clinical, {
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      page,
    })
    expect(denied.ok).toBe(false)
  })

  it('scopes billing-group summary members for operating users', async () => {
    const store = db()
    const summary = await getBillingGroupSummary(store, clinical, ABMED_GROUP_ID)
    expect(summary.ok).toBe(true)
    if (summary.ok) {
      expect(summary.value.memberAccounts).toHaveLength(1)
      expect(summary.value.memberAccounts[0].customerAccountId).toBe(ABMED_CLINICAL_ACCOUNT_ID)
      expect(summary.value.checkoutEnabled).toBe(false)
    }
    const payerView = await getBillingGroupSummary(store, payer, ABMED_GROUP_ID)
    expect(payerView.ok).toBe(true)
    if (payerView.ok) expect(payerView.value.memberAccounts.length).toBe(3)
  })

  it('returns wallet summary for billing role and denies operating-only wallet read', async () => {
    const store = db()
    const payerWallet = await getBillingGroupWalletSummary(store, payer, ABMED_GROUP_ID)
    expect(payerWallet.ok).toBe(true)
    if (payerWallet.ok) {
      expect(payerWallet.value.availableBalance).toBe(800)
      expect(payerWallet.value.postedBalance).toBe(900)
    }
    const clinicalWallet = await getBillingGroupWalletSummary(store, clinical, ABMED_GROUP_ID)
    expect(clinicalWallet.ok).toBe(false)
  })

  it('lists billing-group orders for payer and blocks sibling account filter for operating user', async () => {
    const store = db()
    await seedCreditOrder(store, ABMED_AESTHETICS_ACCOUNT_ID, 'bg-aes')
    const payerList = await listBillingGroupPurchaseHistory(store, payer, {
      billingGroupId: ABMED_GROUP_ID,
      page,
    })
    expect(payerList.ok).toBe(true)
    if (payerList.ok) expect(payerList.value.items.length).toBe(1)
    const clinicalFilter = await listBillingGroupPurchaseHistory(store, clinical, {
      billingGroupId: ABMED_GROUP_ID,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      page,
    })
    expect(clinicalFilter.ok).toBe(false)
  })

  it('admin catalog read and OPEN-001 activation guards', async () => {
    const store = db()
    await ensureCatalogSkeleton(store)
    const catalog = await listAdminCatalog(store, staff)
    expect(catalog.ok).toBe(true)
    if (catalog.ok) expect(catalog.value.some((p) => p.productKey === 'crm.included')).toBe(true)
    const blocked = await setProductActivationStatus(store, staff, 'crm.included', 'ACTIVE')
    expect(blocked.ok).toBe(false)
    if (!blocked.ok) expect(blocked.error).toBe('POLICY_UNRESOLVED')
    const price = await configureProductPrice(store, {
      actor: staff,
      productKey: 'messaging.credits',
      currency: 'USD',
      amountMinor: 9900,
      billingInterval: 'NONE',
      priceVersion: 'commerce12-admin-v1',
      creditAmount: 1000,
      effectiveFrom: from,
    })
    if (!price.ok) throw new Error(price.error)
    const deactivate = await setPriceActivationStatus(store, staff, price.value.id, 'INACTIVE')
    expect(deactivate.ok).toBe(true)
    const reactivate = await setPriceActivationStatus(store, staff, price.value.id, 'ACTIVE')
    expect(reactivate.ok).toBe(true)
  })

  it('keeps commerce backend disabled when COMMERCE_BACKEND_ENABLED is unset', () => {
    delete process.env.COMMERCE_BACKEND_ENABLED
    expect(isCommerceBackendEnabled()).toBe(false)
  })
})

import { prisma } from '@/lib/db'
import {
  isCommerceProvisioningEnabled,
  isCommerceSubscriptionProviderEnabled,
} from '@/config/commerce-backend'
import { isWalletBackendEnabled, isWalletGroupReadEnabled } from '@/config/wallet-backend'
import type { PortalUser } from '@/lib/portal/authz'
import { isPrismaMissingTableError } from '@/lib/platform/business-overview/access'
import { COMMERCE_CATALOG_SKELETON } from '@/lib/platform/commerce/catalog'
import {
  BILLING_PAYER_OPERATIONAL_ISOLATION,
  classifyFinancialInstrument,
  type FinancialInstrument,
} from '@/lib/platform/commerce/financial-boundaries'
import { assertBillingGroupReader } from '@/lib/platform/commerce/portal-api'
import { prismaCommerceStore } from '@/lib/platform/commerce/prisma-store'
import type { CommerceStore } from '@/lib/platform/commerce/store'
import type { CommerceActor, ProductRecord } from '@/lib/platform/commerce/types'
import {
  COMMERCE_EXECUTION_BATCH_VERSION,
  COMMERCE_EXECUTION_PLANNING_DISCLOSURE,
  COMMERCE_EXECUTION_PROVENANCE_NOTICE,
} from '@/lib/platform/commerce-execution/constants'
import {
  loadCommerceExecutionContext,
  resolveCommerceExecutionCoreAccess,
} from '@/lib/platform/commerce-execution/access'
import { resolveManagedServiceLifecycle } from '@/lib/platform/commerce-execution/managed-service-lifecycle'
import { buildPaymentProviderReadiness } from '@/lib/platform/commerce-execution/payment-readiness'
import type {
  CommerceExecutionSlice,
  CommerceExecutionSummaryResponse,
  ManagedServiceLifecycleRow,
} from '@/lib/platform/commerce-execution/types'
import { getCustomerInfrastructureOverview } from '@/lib/infrastructure/queries'
import { getWalletBalance } from '@/lib/platform/wallet/durable-service'

export type CommerceExecutionResult =
  | { ok: true; value: CommerceExecutionSummaryResponse }
  | { ok: false; code: 'NOT_FOUND'; message: string }

function unavailable<T>(
  sourceModule: CommerceExecutionSlice<T>['sourceModule'],
  reasonCode: string,
  message: string,
): CommerceExecutionSlice<T> {
  return { status: 'UNAVAILABLE', sourceModule, reasonCode, message }
}

function available<T>(
  sourceModule: CommerceExecutionSlice<T>['sourceModule'],
  data: T,
): CommerceExecutionSlice<T> {
  return { status: 'AVAILABLE', sourceModule, data }
}

function skeletonAsProduct(row: (typeof COMMERCE_CATALOG_SKELETON)[number]): ProductRecord {
  const now = new Date(0)
  return {
    id: `skel_${row.productKey}`,
    publicId: `skel_${row.productKey}`,
    productKey: row.productKey,
    kind: row.kind,
    name: row.name,
    description: null,
    status: 'ACTIVE',
    pricingMode: row.pricingMode,
    entitlementKey: row.entitlementKey,
    creditEligible: row.creditEligible,
    eligibilityCohort: row.eligibilityCohort,
    featureFlag: row.featureFlag,
    purchasable: row.purchasable,
    providerPassThrough: row.providerPassThrough,
    createdAt: now,
    updatedAt: now,
  }
}

async function resolveManagedSiteScope(
  customerAccountId: string,
  managedSiteId?: string | null,
): Promise<{ ok: true; managedSiteId: string | null } | { ok: false; message: string }> {
  if (!managedSiteId) return { ok: true, managedSiteId: null }
  const site = await prisma.managedSite.findFirst({
    where: { id: managedSiteId, customerAccountId },
    select: { id: true },
  })
  if (!site) return { ok: false, message: 'Managed site not found for account' }
  return { ok: true, managedSiteId: site.id }
}

async function resolveBillingGroupId(
  store: CommerceStore,
  customerAccountId: string,
  preferred?: string | null,
): Promise<{ billingGroupId: string | null; preferredRejected: boolean }> {
  if (preferred) {
    const memberships = await store.listFundingMemberships(preferred, customerAccountId)
    if (memberships.some((m) => m.status === 'ACTIVE')) {
      return { billingGroupId: preferred, preferredRejected: false }
    }
    // Fail closed: do not silently substitute another group for an unauthorized preferred id.
    return { billingGroupId: null, preferredRejected: true }
  }
  try {
    const row = await prisma.billingGroupMembership.findFirst({
      where: { customerAccountId, status: 'ACTIVE' },
      select: { billingGroupId: true },
      orderBy: { validFrom: 'desc' },
    })
    return { billingGroupId: row?.billingGroupId ?? null, preferredRejected: false }
  } catch (error) {
    if (!isPrismaMissingTableError(error)) throw error
    return { billingGroupId: null, preferredRejected: false }
  }
}

function toCommerceActor(portal: PortalUser): CommerceActor {
  const platformRole =
    portal.role === 'ADMIN' || portal.role === 'STAFF' ? portal.role : 'CUSTOMER'
  return { userId: portal.id, platformRole }
}

function isStaffActor(actor: CommerceActor): boolean {
  return actor.platformRole === 'ADMIN' || actor.platformRole === 'STAFF'
}

export type CommerceExecutionDeps = {
  store?: CommerceStore
  infrastructureOverview?: (customerAccountId: string) => Promise<{
    hosting: Array<{
      publicId: string
      status: string
      dataSource: string
      externalProviderRef: string | null
    }>
    domains: Array<{
      publicId: string
      verificationStatus: string
      dataSource: string
      providerReference: string | null
    }>
    email: Array<{
      publicId: string
      status: string
      dataSource: string
      externalProviderRef: string | null
    }>
  }>
  walletBalance?: (billingGroupId: string) => Promise<{
    walletId: string
    availableBalance: number
  } | null>
}

export async function getCommerceExecutionSummary(input: {
  portal: PortalUser
  managedSiteId?: string | null
  billingGroupId?: string | null
  deps?: CommerceExecutionDeps
}): Promise<CommerceExecutionResult> {
  const now = new Date()
  const customerAccountId = input.portal.customerAccount.id
  const store = input.deps?.store ?? prismaCommerceStore

  const scope = await resolveManagedSiteScope(customerAccountId, input.managedSiteId)
  if (!scope.ok) return { ok: false, code: 'NOT_FOUND', message: scope.message }

  const ctx = await loadCommerceExecutionContext(input.portal)
  const coreAccess = resolveCommerceExecutionCoreAccess(ctx)
  const coreBlocked =
    coreAccess === 'proceed' || coreAccess.state === 'available'
      ? null
      : { reasonCode: coreAccess.reasonCode, message: coreAccess.message }

  const catalogEntitlements = available('commerce.catalog_entitlements', {
    products: COMMERCE_CATALOG_SKELETON.map((row) => {
      const product = skeletonAsProduct(row)
      return {
        productKey: row.productKey,
        kind: row.kind,
        name: row.name,
        pricingMode: row.pricingMode,
        purchasable: row.purchasable,
        creditEligible: row.creditEligible,
        eligibilityCohort: row.eligibilityCohort,
        entitlementKey: row.entitlementKey,
        instrument: classifyFinancialInstrument(product),
        providerPassThrough: row.providerPassThrough,
      }
    }),
    subscriberOnlyPreserved: true as const,
    includedFreeNotPayable: true as const,
    note: 'INCLUDED_FREE products remain non-purchasable; OPEN-001 SUBSCRIBER_ONLY eligibility preserved.',
  })

  let purchaseHistory: CommerceExecutionSummaryResponse['purchaseHistory'] = unavailable(
    'commerce.purchase_history',
    'DATA_UNAVAILABLE',
    'Purchase history unavailable',
  )
  let billingGroupPayer: CommerceExecutionSummaryResponse['billingGroupPayer'] = unavailable(
    'commerce.billing_group_payer',
    'DATA_UNAVAILABLE',
    'Billing group payer unavailable',
  )
  let walletInstrumentBoundary: CommerceExecutionSummaryResponse['walletInstrumentBoundary'] = unavailable(
    'commerce.wallet_instrument_boundary',
    'DATA_UNAVAILABLE',
    'Wallet instrument boundary unavailable',
  )
  let managedServicesLifecycle: CommerceExecutionSummaryResponse['managedServicesLifecycle'] = unavailable(
    'commerce.managed_services_lifecycle',
    'DATA_UNAVAILABLE',
    'Managed services lifecycle unavailable',
  )
  let subscriptionState: CommerceExecutionSummaryResponse['subscriptionState'] = unavailable(
    'commerce.subscription_state',
    'DATA_UNAVAILABLE',
    'Subscription state unavailable',
  )
  let invoiceReferences: CommerceExecutionSummaryResponse['invoiceReferences'] = unavailable(
    'commerce.invoice_references',
    'DATA_UNAVAILABLE',
    'Invoice references unavailable',
  )

  const paymentProviderReadiness = available(
    'commerce.payment_provider_readiness',
    buildPaymentProviderReadiness(null),
  )

  const fulfillmentPolicy = available('commerce.fulfillment_policy', {
    paymentEvidenceRequired: true as const,
    duplicateCheckoutRejected: true as const,
    duplicateWebhookRejected: true as const,
    moneyOrdersNeverDebitMessagingWallet: true as const,
    historicalPriceSnapshotsPreserved: true as const,
    includedFreeNotConvertedToPaid: true as const,
    activationWithoutCaptureBlocked: true as const,
  })

  if (coreBlocked) {
    purchaseHistory = unavailable('commerce.purchase_history', coreBlocked.reasonCode, coreBlocked.message)
    billingGroupPayer = unavailable('commerce.billing_group_payer', coreBlocked.reasonCode, coreBlocked.message)
    walletInstrumentBoundary = unavailable(
      'commerce.wallet_instrument_boundary',
      coreBlocked.reasonCode,
      coreBlocked.message,
    )
    managedServicesLifecycle = unavailable(
      'commerce.managed_services_lifecycle',
      coreBlocked.reasonCode,
      coreBlocked.message,
    )
    subscriptionState = unavailable('commerce.subscription_state', coreBlocked.reasonCode, coreBlocked.message)
    invoiceReferences = unavailable('commerce.invoice_references', coreBlocked.reasonCode, coreBlocked.message)
  } else {
    try {
      const actor = toCommerceActor(input.portal)
      const resolvedGroup = await resolveBillingGroupId(store, customerAccountId, input.billingGroupId)
      const billingGroupId = resolvedGroup.billingGroupId
      const orders = await store.listOrdersByAccount(customerAccountId)
      const purchaseRows = []
      for (const order of orders.slice(0, 50)) {
        const items = await store.listItems(order.id)
        const instruments: FinancialInstrument[] = []
        for (const item of items) {
          const product = await store.findProduct(item.productId)
          if (product) instruments.push(classifyFinancialInstrument(product))
          else {
            const skel = COMMERCE_CATALOG_SKELETON.find((r) => r.productKey === item.productKey)
            if (skel) instruments.push(classifyFinancialInstrument(skeletonAsProduct(skel)))
          }
        }
        purchaseRows.push({
          orderId: order.id,
          publicId: order.publicId,
          billingGroupId: order.billingGroupId,
          customerAccountId: order.customerAccountId,
          status: order.status,
          currency: order.currency,
          totalMinor: order.totalMinor,
          productKeys: items.map((i) => i.productKey),
          instruments,
          createdAt: order.createdAt.toISOString(),
        })
      }
      purchaseHistory = available('commerce.purchase_history', {
        orders: purchaseRows,
        isolationBoundary: 'CUSTOMER_ACCOUNT',
        billingGroupDoesNotGrantSiblingPurchaseVisibility: true,
      })

      if (resolvedGroup.preferredRejected) {
        billingGroupPayer = unavailable(
          'commerce.billing_group_payer',
          'FORBIDDEN',
          'Billing group is not authorized for this customer account',
        )
        walletInstrumentBoundary = unavailable(
          'commerce.wallet_instrument_boundary',
          'FORBIDDEN',
          'Billing group is not authorized for this customer account',
        )
      } else if (billingGroupId) {
        const reader = await assertBillingGroupReader(store, actor, billingGroupId)
        if (!reader.ok) {
          billingGroupPayer = unavailable(
            'commerce.billing_group_payer',
            reader.error,
            'Billing group financial read is not authorized',
          )
          walletInstrumentBoundary = unavailable(
            'commerce.wallet_instrument_boundary',
            reader.error,
            'Billing group wallet read is not authorized',
          )
        } else {
          const allMembers = await store.listBillingGroupMembers(billingGroupId)
          let memberAccountIds = allMembers.map((m) => m.customerAccountId)
          if (!isStaffActor(actor) && !reader.value.role) {
            const operatingIds = new Set<string>()
            for (const member of allMembers) {
              if (await store.hasOperatingMembership(actor.userId, member.customerAccountId)) {
                operatingIds.add(member.customerAccountId)
              }
            }
            memberAccountIds = allMembers
              .filter((m) => operatingIds.has(m.customerAccountId))
              .map((m) => m.customerAccountId)
          }
          const payerAuthorized = Boolean(
            isStaffActor(actor) ||
              reader.value.role === 'GROUP_OWNER' ||
              reader.value.role === 'BILLING_ADMIN',
          )
          billingGroupPayer = available('commerce.billing_group_payer', {
            billingGroupId,
            payerAuthorized,
            callerRole: reader.value.role,
            memberAccountIds,
            operationalIsolation: BILLING_PAYER_OPERATIONAL_ISOLATION,
            abmedPatternSupported: true,
          })

          // Mirror getBillingGroupWalletSummary: operating members without a billing role
          // never receive group wallet id/balance; WALLET_GROUP_READ_ENABLED gates nonstaff.
          const canReadGroupWallet =
            isStaffActor(actor) ||
            reader.value.role === 'GROUP_OWNER' ||
            reader.value.role === 'BILLING_ADMIN' ||
            reader.value.role === 'BILLING_VIEWER'
          let walletId: string | null = null
          let availableCredits: number | null = null
          let walletNote =
            'Shared messaging credit wallet must not be debited for hosting, domain, subscription, or business-email money purchases.'
          if (!canReadGroupWallet) {
            walletNote =
              'Operating membership alone does not disclose shared BillingGroup wallet balances; billing-reader role required.'
          } else if (!isWalletBackendEnabled()) {
            walletNote = 'Wallet backend disabled; money purchases remain distinct from messaging credits.'
          } else if (!isWalletGroupReadEnabled() && !isStaffActor(actor)) {
            walletNote = 'WALLET_GROUP_READ_ENABLED is off; group wallet balances are concealed for nonstaff readers.'
          } else {
            const injected = input.deps?.walletBalance
              ? await input.deps.walletBalance(billingGroupId)
              : null
            if (injected) {
              walletId = injected.walletId
              availableCredits = injected.availableBalance
            } else {
              try {
                const wallet = await store.findWallet(billingGroupId)
                if (wallet) {
                  walletId = wallet.id
                  const balance = await getWalletBalance(prisma, wallet.id)
                  availableCredits = balance?.availableBalance ?? null
                }
              } catch (error) {
                if (!isPrismaMissingTableError(error)) throw error
              }
            }
          }
          walletInstrumentBoundary = available('commerce.wallet_instrument_boundary', {
            messagingCreditType: 'MESSAGING',
            moneyPurchasesDebitWallet: false,
            hostingDomainSubscriptionUseWallet: false,
            billingGroupId,
            walletId,
            availableCredits,
            note: walletNote,
          })
        }
      } else {
        billingGroupPayer = available('commerce.billing_group_payer', {
          billingGroupId: null,
          payerAuthorized: false,
          callerRole: null,
          memberAccountIds: [],
          operationalIsolation: BILLING_PAYER_OPERATIONAL_ISOLATION,
          abmedPatternSupported: true,
        })
        walletInstrumentBoundary = available('commerce.wallet_instrument_boundary', {
          messagingCreditType: 'MESSAGING',
          moneyPurchasesDebitWallet: false,
          hostingDomainSubscriptionUseWallet: false,
          billingGroupId: null,
          walletId: null,
          availableCredits: null,
          note: 'No active BillingGroup membership for this account.',
        })
      }

      const provisioningEnabled = isCommerceProvisioningEnabled()
      const managedRows: ManagedServiceLifecycleRow[] = []
      const projectServices = await store.listProjectServicesByAccount(customerAccountId)
      for (const service of projectServices) {
        const order = service.commerceOrderId ? await store.findOrder(service.commerceOrderId) : null
        const payment = order ? await store.findPaymentByOrder(order.id) : null
        const fulfillment = order ? await store.findFulfillmentByOrder(order.id) : null
        const serviceOrder = order ? await store.findServiceOrderByCommerceOrder(order.id) : null
        managedRows.push(
          resolveManagedServiceLifecycle({
            serviceKey: service.id,
            productKey: service.productKey,
            customerAccountId,
            serviceOrderStatus: serviceOrder?.status ?? null,
            orderStatus: order?.status ?? null,
            paymentStatus: payment?.status ?? null,
            fulfillmentStatus: fulfillment?.status ?? null,
            commerceOrderId: service.commerceOrderId,
            provisioningEnabled,
          }),
        )
      }

      const loadInfra =
        input.deps?.infrastructureOverview ??
        (async (accountId: string) => getCustomerInfrastructureOverview(accountId))
      try {
        const infra = await loadInfra(customerAccountId)
        for (const host of infra.hosting) {
          managedRows.push(
            resolveManagedServiceLifecycle({
              serviceKey: host.publicId,
              productKey: 'website.hosting',
              customerAccountId,
              infraStatus: host.status,
              dataSource: host.dataSource === 'PROVIDER_VERIFIED' ? 'PROVIDER_VERIFIED' : 'MANUAL',
              externalProviderRef: host.externalProviderRef,
              provisioningEnabled,
            }),
          )
        }
        for (const domain of infra.domains) {
          managedRows.push(
            resolveManagedServiceLifecycle({
              serviceKey: domain.publicId,
              productKey: 'domain.registration',
              customerAccountId,
              infraStatus: domain.verificationStatus,
              dataSource: domain.dataSource === 'PROVIDER_VERIFIED' ? 'PROVIDER_VERIFIED' : 'MANUAL',
              externalProviderRef: domain.providerReference,
              provisioningEnabled,
            }),
          )
        }
        for (const email of infra.email) {
          managedRows.push(
            resolveManagedServiceLifecycle({
              serviceKey: email.publicId,
              productKey: 'email.business',
              customerAccountId,
              infraStatus: email.status,
              dataSource: email.dataSource === 'PROVIDER_VERIFIED' ? 'PROVIDER_VERIFIED' : 'MANUAL',
              externalProviderRef: email.externalProviderRef,
              provisioningEnabled,
            }),
          )
        }
      } catch (error) {
        if (!isPrismaMissingTableError(error)) throw error
      }

      managedServicesLifecycle = available('commerce.managed_services_lifecycle', {
        services: managedRows,
        activeRequiresProviderEvidence: true,
        provisioningLiveBlocked: true,
      })

      const subscriptionRows: Array<{
        subscriptionId: string
        publicId: string
        customerAccountId: string | null
        productId: string
        status: import('@/lib/platform/commerce/types').SubscriptionStatus
        billingGroupId: string
        externalSubscriptionRef: string | null
        providerActivated: boolean
      }> = []
      const invoiceRows: Array<{
        invoiceId: string
        publicId: string
        billingGroupId: string
        customerAccountId: string | null
        orderId: string | null
        subscriptionId: string | null
        status: string
        amountMinor: number
        currency: string
        externalInvoiceRef: string | null
      }> = []

      for (const order of orders) {
        const sub = await store.findSubscriptionByOrder(order.id)
        if (sub && (!sub.customerAccountId || sub.customerAccountId === customerAccountId)) {
          subscriptionRows.push({
            subscriptionId: sub.id,
            publicId: sub.publicId,
            customerAccountId: sub.customerAccountId,
            productId: sub.productId,
            status: sub.status,
            billingGroupId: sub.billingGroupId,
            externalSubscriptionRef: sub.externalSubscriptionRef,
            providerActivated: Boolean(sub.externalSubscriptionRef) && sub.status === 'ACTIVE',
          })
        }
        const invoices = await store.listInvoicesByOrder(order.id)
        for (const inv of invoices) {
          if (inv.customerAccountId && inv.customerAccountId !== customerAccountId) continue
          invoiceRows.push({
            invoiceId: inv.id,
            publicId: inv.publicId,
            billingGroupId: inv.billingGroupId,
            customerAccountId: inv.customerAccountId,
            orderId: inv.orderId,
            subscriptionId: inv.subscriptionId,
            status: inv.status,
            amountMinor: inv.amountMinor,
            currency: inv.currency,
            externalInvoiceRef: inv.externalInvoiceRef,
          })
        }
      }

      subscriptionState = available('commerce.subscription_state', {
        subscriptions: subscriptionRows,
        providerSubscriptionCallsBlocked: !isCommerceSubscriptionProviderEnabled(),
      })
      invoiceReferences = available('commerce.invoice_references', {
        invoices: invoiceRows,
        note: 'Invoice rows are WebXXL references; external invoice refs require verified provider events.',
      })
    } catch (error) {
      if (!isPrismaMissingTableError(error)) throw error
      purchaseHistory = unavailable('commerce.purchase_history', 'DATA_UNAVAILABLE', 'Commerce tables unavailable')
    }
  }

  return {
    ok: true,
    value: {
      customerAccountId,
      managedSiteId: scope.managedSiteId,
      assembledAt: now.toISOString(),
      accountScope: 'session_membership',
      batchVersion: COMMERCE_EXECUTION_BATCH_VERSION,
      provenanceNotice: COMMERCE_EXECUTION_PROVENANCE_NOTICE,
      planningDisclosure: COMMERCE_EXECUTION_PLANNING_DISCLOSURE,
      catalogEntitlements,
      purchaseHistory,
      billingGroupPayer,
      walletInstrumentBoundary,
      paymentProviderReadiness,
      managedServicesLifecycle,
      subscriptionState,
      invoiceReferences,
      fulfillmentPolicy,
    },
  }
}

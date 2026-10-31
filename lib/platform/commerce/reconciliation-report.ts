import {
  isCommerceFulfillmentEnabled,
  isCommerceWalletMintEnabled,
  isCommerceWebhookProcessingEnabled,
} from '@/config/commerce-backend'
import { compensatingWalletRefundRecommended } from '@/lib/platform/commerce/lifecycle'
import type { CommerceStore } from '@/lib/platform/commerce/store'
import type { CommerceResult } from '@/lib/platform/commerce/types'

export const COMMERCE_RECONCILIATION_DEFAULT_LIMIT = 50
export const COMMERCE_RECONCILIATION_MAX_ORDER_SCAN = 50
export const COMMERCE_RECONCILIATION_MAX_FUNDING_SCAN = 50
export const COMMERCE_RECONCILIATION_MAX_WEBHOOK_SCAN = 50

export type CommerceReconciliationFinding = {
  code:
    | 'PAID_WITHOUT_FULFILLMENT'
    | 'FULFILLMENT_WITHOUT_CAPTURED_PAYMENT'
    | 'FUNDING_WITHOUT_LEDGER'
    | 'WEBHOOK_REVIEW'
    | 'SUBSCRIPTION_ORDER_MISMATCH'
    | 'COMPENSATING_REFUND_REVIEW'
    | 'LATE_CAPTURE_AFTER_CANCEL'
  orderId?: string
  subscriptionId?: string
  fundingId?: string
  webhookId?: string
  detail: string
}

export type CommerceReconciliationScanCoverage = {
  ordersInGroup: number
  ordersScanned: number
  orderScanLimit: number
  ordersScanComplete: boolean
  fundingRowsInGroup: number
  fundingRowsScanned: number
  fundingScanLimit: number
  fundingScanComplete: boolean
  webhookRowsInGroup: number
  webhookRowsScanned: number
  webhookScanLimit: number
  webhookScanComplete: boolean
}

export type CommerceReconciliationReport = {
  generatedAt: string
  billingGroupId: string
  bounded: true
  findingsLimit: number
  findings: CommerceReconciliationFinding[]
  findingsTruncated: boolean
  scanCoverage: CommerceReconciliationScanCoverage
  /** False when any scan dimension is partial or findings hit the cap — not a full group-wide reconciliation. */
  groupReconciliationComplete: boolean
  activation: {
    webhookProcessing: boolean
    fulfillment: boolean
    walletMint: boolean
    correctiveMutationsEnabled: false
  }
  ownerPolicyUnresolved: string[]
}

const OWNER_POLICY_GAPS = [
  'Final subscription grace periods after past_due are not defined in commerce source.',
  'Tax, refund, and chargeback policies remain owner-controlled; commerce stores snapshots only.',
  'Live payment providers and wallet mint activation remain disabled without separate owner authorization.',
  'This report is a bounded scan; partial coverage is explicit in scanCoverage and groupReconciliationComplete.',
]

function pushFinding(
  findings: CommerceReconciliationFinding[],
  item: CommerceReconciliationFinding,
  findingsLimit: number,
): boolean {
  if (findings.length >= findingsLimit) return true
  findings.push(item)
  return findings.length >= findingsLimit
}

export async function buildCommerceReconciliationReport(
  store: CommerceStore,
  billingGroupId: string,
  findingsLimit = COMMERCE_RECONCILIATION_DEFAULT_LIMIT,
  scanLimits?: {
    orderScan?: number
    fundingScan?: number
    webhookScan?: number
  },
): Promise<CommerceResult<CommerceReconciliationReport>> {
  const group = await store.findBillingGroup(billingGroupId)
  if (!group) return { ok: false, error: 'ACCOUNT_NOT_FUNDED' }

  const orderScanLimit = Math.min(scanLimits?.orderScan ?? COMMERCE_RECONCILIATION_MAX_ORDER_SCAN, COMMERCE_RECONCILIATION_MAX_ORDER_SCAN)
  const fundingScanLimit = Math.min(
    scanLimits?.fundingScan ?? COMMERCE_RECONCILIATION_MAX_FUNDING_SCAN,
    COMMERCE_RECONCILIATION_MAX_FUNDING_SCAN,
  )
  const webhookScanLimit = Math.min(
    scanLimits?.webhookScan ?? COMMERCE_RECONCILIATION_MAX_WEBHOOK_SCAN,
    COMMERCE_RECONCILIATION_MAX_WEBHOOK_SCAN,
  )

  const findings: CommerceReconciliationFinding[] = []
  let findingsTruncated = false

  const orderPage = await store.listReconciliationOrderContexts(billingGroupId, 0, orderScanLimit)
  for (const { order, payment, fulfillment, subscription } of orderPage.contexts) {
    if (findingsTruncated) break
    if (order.failureCode === 'LATE_CAPTURE_AFTER_CANCEL' && payment?.status === 'CAPTURED') {
      findingsTruncated =
        pushFinding(
          findings,
          {
            code: 'LATE_CAPTURE_AFTER_CANCEL',
            orderId: order.id,
            detail:
              'Verified payment captured after payer cancellation; fulfillment and workflow intentionally deferred pending operator review.',
          },
          findingsLimit,
        ) || findingsTruncated
      continue
    }
    const paidLike = ['PAID', 'FULFILLMENT_PENDING', 'FULFILLMENT_BLOCKED'].includes(order.status)
    if (paidLike && (!fulfillment || fulfillment.status !== 'COMPLETED')) {
      findingsTruncated =
        pushFinding(
          findings,
          {
            code: 'PAID_WITHOUT_FULFILLMENT',
            orderId: order.id,
            detail: `Order ${order.status} without completed fulfillment (${fulfillment?.status ?? 'none'}).`,
          },
          findingsLimit,
        ) || findingsTruncated
    }
    if (fulfillment?.status === 'COMPLETED' && payment?.status !== 'CAPTURED') {
      findingsTruncated =
        pushFinding(
          findings,
          {
            code: 'FULFILLMENT_WITHOUT_CAPTURED_PAYMENT',
            orderId: order.id,
            detail: `Fulfillment completed while payment status is ${payment?.status ?? 'missing'}.`,
          },
          findingsLimit,
        ) || findingsTruncated
    }
    if (compensatingWalletRefundRecommended(order, fulfillment)) {
      findingsTruncated =
        pushFinding(
          findings,
          {
            code: 'COMPENSATING_REFUND_REVIEW',
            orderId: order.id,
            detail: 'Refunded credit order has a ledger entry; compensating wallet refund requires activation gates.',
          },
          findingsLimit,
        ) || findingsTruncated
    }
    if (subscription && order.status === 'REFUNDED' && subscription.status === 'ACTIVE') {
      findingsTruncated =
        pushFinding(
          findings,
          {
            code: 'SUBSCRIPTION_ORDER_MISMATCH',
            orderId: order.id,
            subscriptionId: subscription.id,
            detail: 'Order refunded while subscription remains ACTIVE.',
          },
          findingsLimit,
        ) || findingsTruncated
    }
  }

  const fundingRows = await store.listFundingByBillingGroup(billingGroupId, fundingScanLimit)
  const fundingRowsInGroup = await store.countFundingByBillingGroup(billingGroupId)
  for (const funding of fundingRows) {
    if (findingsTruncated) break
    if (!funding.ledgerEntryId && funding.verifiedAt) {
      findingsTruncated =
        pushFinding(
          findings,
          {
            code: 'FUNDING_WITHOUT_LEDGER',
            fundingId: funding.id,
            orderId: funding.commerceOrderId,
            detail: `Funding evidence ${funding.externalPaymentRef} verified without ledger entry.`,
          },
          findingsLimit,
        ) || findingsTruncated
    }
  }

  const webhooks = await store.listWebhooksByBillingGroup(billingGroupId, webhookScanLimit)
  const webhookRowsInGroup = await store.countWebhooksByBillingGroup(billingGroupId)
  for (const webhook of webhooks) {
    if (findingsTruncated) break
    if (['OUT_OF_ORDER', 'FAILED', 'RECEIVED'].includes(webhook.processingStatus)) {
      findingsTruncated =
        pushFinding(
          findings,
          {
            code: 'WEBHOOK_REVIEW',
            webhookId: webhook.id,
            orderId: webhook.orderId ?? undefined,
            detail: `${webhook.eventType} ${webhook.processingStatus}${webhook.failureCode ? ` (${webhook.failureCode})` : ''}.`,
          },
          findingsLimit,
        ) || findingsTruncated
    }
  }

  const ordersScanned = orderPage.contexts.length
  const ordersScanComplete = orderPage.totalOrders <= orderScanLimit
  const fundingScanComplete = fundingRowsInGroup <= fundingScanLimit
  const webhookScanComplete = webhookRowsInGroup <= webhookScanLimit

  const scanCoverage: CommerceReconciliationScanCoverage = {
    ordersInGroup: orderPage.totalOrders,
    ordersScanned,
    orderScanLimit,
    ordersScanComplete,
    fundingRowsInGroup,
    fundingRowsScanned: fundingRows.length,
    fundingScanLimit,
    fundingScanComplete,
    webhookRowsInGroup,
    webhookRowsScanned: webhooks.length,
    webhookScanLimit,
    webhookScanComplete,
  }

  const groupReconciliationComplete =
    ordersScanComplete && fundingScanComplete && webhookScanComplete && !findingsTruncated

  return {
    ok: true,
    value: {
      generatedAt: new Date().toISOString(),
      billingGroupId,
      bounded: true,
      findingsLimit,
      findings,
      findingsTruncated,
      scanCoverage,
      groupReconciliationComplete,
      activation: {
        webhookProcessing: isCommerceWebhookProcessingEnabled(),
        fulfillment: isCommerceFulfillmentEnabled(),
        walletMint: isCommerceWalletMintEnabled(),
        correctiveMutationsEnabled: false,
      },
      ownerPolicyUnresolved: OWNER_POLICY_GAPS,
    },
  }
}

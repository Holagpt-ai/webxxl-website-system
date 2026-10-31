import {
  isCommerceFulfillmentEnabled,
  isCommerceWalletMintEnabled,
  isCommerceWebhookProcessingEnabled,
} from '@/config/commerce-backend'
import { compensatingWalletRefundRecommended } from '@/lib/platform/commerce/lifecycle'
import type { CommerceStore } from '@/lib/platform/commerce/store'
import type { CommerceResult } from '@/lib/platform/commerce/types'

export const COMMERCE_RECONCILIATION_DEFAULT_LIMIT = 50

export type CommerceReconciliationFinding = {
  code:
    | 'PAID_WITHOUT_FULFILLMENT'
    | 'FULFILLMENT_WITHOUT_CAPTURED_PAYMENT'
    | 'FUNDING_WITHOUT_LEDGER'
    | 'WEBHOOK_REVIEW'
    | 'SUBSCRIPTION_ORDER_MISMATCH'
    | 'COMPENSATING_REFUND_REVIEW'
  orderId?: string
  subscriptionId?: string
  fundingId?: string
  webhookId?: string
  detail: string
}

export type CommerceReconciliationReport = {
  generatedAt: string
  billingGroupId: string
  bounded: true
  limit: number
  findings: CommerceReconciliationFinding[]
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
]

function pushBounded<T>(list: T[], item: T, limit: number): void {
  if (list.length < limit) list.push(item)
}

export async function buildCommerceReconciliationReport(
  store: CommerceStore,
  billingGroupId: string,
  limit = COMMERCE_RECONCILIATION_DEFAULT_LIMIT,
): Promise<CommerceResult<CommerceReconciliationReport>> {
  const group = await store.findBillingGroup(billingGroupId)
  if (!group) return { ok: false, error: 'ACCOUNT_NOT_FUNDED' }
  const findings: CommerceReconciliationFinding[] = []
  const orders = await store.listOrdersByGroup(billingGroupId)
  for (const order of orders) {
    const payment = await store.findPaymentByOrder(order.id)
    const fulfillment = await store.findFulfillmentByOrder(order.id)
    const paidLike = ['PAID', 'FULFILLMENT_PENDING', 'FULFILLMENT_BLOCKED'].includes(order.status)
    if (paidLike && (!fulfillment || fulfillment.status !== 'COMPLETED')) {
      pushBounded(findings, {
        code: 'PAID_WITHOUT_FULFILLMENT',
        orderId: order.id,
        detail: `Order ${order.status} without completed fulfillment (${fulfillment?.status ?? 'none'}).`,
      }, limit)
    }
    if (fulfillment?.status === 'COMPLETED' && payment?.status !== 'CAPTURED') {
      pushBounded(findings, {
        code: 'FULFILLMENT_WITHOUT_CAPTURED_PAYMENT',
        orderId: order.id,
        detail: `Fulfillment completed while payment status is ${payment?.status ?? 'missing'}.`,
      }, limit)
    }
    if (compensatingWalletRefundRecommended(order, fulfillment)) {
      pushBounded(findings, {
        code: 'COMPENSATING_REFUND_REVIEW',
        orderId: order.id,
        detail: 'Refunded credit order has a ledger entry; compensating wallet refund requires activation gates.',
      }, limit)
    }
    const subscription = await store.findSubscriptionByOrder(order.id)
    if (subscription && order.status === 'REFUNDED' && subscription.status === 'ACTIVE') {
      pushBounded(findings, {
        code: 'SUBSCRIPTION_ORDER_MISMATCH',
        orderId: order.id,
        subscriptionId: subscription.id,
        detail: 'Order refunded while subscription remains ACTIVE.',
      }, limit)
    }
  }

  const fundingRows = await store.listFundingByBillingGroup(billingGroupId, limit)
  for (const funding of fundingRows) {
    if (!funding.ledgerEntryId && funding.verifiedAt) {
      pushBounded(findings, {
        code: 'FUNDING_WITHOUT_LEDGER',
        fundingId: funding.id,
        orderId: funding.commerceOrderId,
        detail: `Funding evidence ${funding.externalPaymentRef} verified without ledger entry.`,
      }, limit)
    }
  }

  const webhooks = await store.listWebhooksByBillingGroup(billingGroupId, limit)
  for (const webhook of webhooks) {
    if (['OUT_OF_ORDER', 'FAILED', 'RECEIVED'].includes(webhook.processingStatus)) {
      pushBounded(findings, {
        code: 'WEBHOOK_REVIEW',
        webhookId: webhook.id,
        orderId: webhook.orderId ?? undefined,
        detail: `${webhook.eventType} ${webhook.processingStatus}${webhook.failureCode ? ` (${webhook.failureCode})` : ''}.`,
      }, limit)
    }
  }

  return {
    ok: true,
    value: {
      generatedAt: new Date().toISOString(),
      billingGroupId,
      bounded: true,
      limit,
      findings,
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

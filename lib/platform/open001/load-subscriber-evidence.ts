import { prisma } from '@/lib/db'
import {
  WEBSITE_SUBSCRIPTION_PRODUCT_KEY,
  emptySubscriberEvidence,
  type SubscriberEvidenceSnapshot,
} from '@/lib/platform/open001/subscriber-evidence'
import type { SubscriptionStatus } from '@/lib/platform/commerce/types'

/** Read-only subscription evidence for one CustomerAccount (never uses BillingGroup alone). */
export async function loadSubscriberEvidenceForAccount(
  customerAccountId: string,
): Promise<SubscriberEvidenceSnapshot> {
  if (!process.env.DATABASE_URL?.trim()) {
    return {
      ...emptySubscriberEvidence(customerAccountId),
      loadOutcome: 'failed',
      loadError: 'DATABASE_URL is not configured',
    }
  }

  try {
    const [subscriptions, customerServices] = await Promise.all([
      prisma.commerceSubscription.findMany({
        where: { customerAccountId },
        select: {
          customerAccountId: true,
          status: true,
          product: { select: { productKey: true } },
        },
      }),
      prisma.customerService.findMany({
        where: {
          customerAccountId,
          status: { in: ['ACTIVE', 'PENDING'] },
        },
        select: {
          customerAccountId: true,
          serviceKey: true,
          status: true,
          metadata: true,
        },
      }),
    ])
    return {
      customerAccountId,
      subscriptions: subscriptions
        .filter((row) => row.customerAccountId && row.product.productKey === WEBSITE_SUBSCRIPTION_PRODUCT_KEY)
        .map((row) => ({
          customerAccountId: row.customerAccountId!,
          productKey: row.product.productKey,
          status: row.status as SubscriptionStatus,
        })),
      legacyWebsiteServices: customerServices.map((row) => ({
        customerAccountId: row.customerAccountId,
        serviceKey: row.serviceKey,
        status: row.status,
        metadata: row.metadata ?? undefined,
      })),
      loadOutcome: 'ok',
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      ...emptySubscriberEvidence(customerAccountId),
      loadOutcome: 'failed',
      loadError: message,
    }
  }
}

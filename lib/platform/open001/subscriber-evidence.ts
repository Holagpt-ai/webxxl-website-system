import type { SubscriptionStatus } from '@/lib/platform/commerce/types'

/** Commerce product key for qualifying website subscriptions (account-scoped). */
export const WEBSITE_SUBSCRIPTION_PRODUCT_KEY = 'website.subscription' as const

/** CustomerService.serviceKey for reconciled legacy website subscription evidence only. */
export const LEGACY_WEBSITE_SUBSCRIBER_SERVICE_KEY = 'paid.website-subscription' as const

export type WebsiteSubscriptionEvidenceRow = {
  customerAccountId: string
  productKey: string
  status: SubscriptionStatus
}

export type LegacyWebsiteServiceEvidenceRow = {
  customerAccountId: string
  serviceKey: string
  status: string
  metadata?: unknown
}

export type SubscriberEvidenceSnapshot = {
  customerAccountId: string
  subscriptions: WebsiteSubscriptionEvidenceRow[]
  legacyWebsiteServices: LegacyWebsiteServiceEvidenceRow[]
  /** When `failed`, callers must fail closed as unverifiable — not as eligible. */
  loadOutcome: 'ok' | 'failed' | 'synthetic'
  loadError?: string
}

export function emptySubscriberEvidence(customerAccountId: string): SubscriberEvidenceSnapshot {
  return {
    customerAccountId,
    subscriptions: [],
    legacyWebsiteServices: [],
    loadOutcome: 'synthetic',
  }
}

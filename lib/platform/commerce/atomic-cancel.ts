import type { CheckoutRecord, OrderRecord } from '@/lib/platform/commerce/types'

export const UNPAID_CANCELLABLE_ORDER_STATUSES: OrderRecord['status'][] = ['PENDING', 'CHECKOUT_CREATED', 'PAYMENT_PENDING']

/** Provider handoff exists; local settlement cannot be confirmed without live provider APIs (disabled). */
export function hasUnconfirmedProviderCheckout(checkouts: CheckoutRecord[]): boolean {
  return checkouts.some(
    (checkout) =>
      Boolean(checkout.externalCheckoutRef) &&
      checkout.status !== 'CANCELLED' &&
      checkout.status !== 'EXPIRED' &&
      checkout.status !== 'DISABLED',
  )
}

export type AtomicCancelUnpaidOutcome =
  | { kind: 'cancelled'; order: OrderRecord; priorStatus: OrderRecord['status'] }
  | { kind: 'already_cancelled'; order: OrderRecord }
  | { kind: 'payment_captured'; order: OrderRecord }
  | { kind: 'status_not_cancellable'; order: OrderRecord }
  | { kind: 'provider_checkout_unconfirmed'; order: OrderRecord }
  | { kind: 'not_found' }
  | { kind: 'concurrent_conflict'; order: OrderRecord }

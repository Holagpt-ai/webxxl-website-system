import type { OrderStatus, PaymentStatus, SubscriptionStatus } from '@/lib/platform/commerce/types'

const ORDER_EDGES: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['CHECKOUT_CREATED', 'FAILED', 'CANCELLED'],
  CHECKOUT_CREATED: ['PAYMENT_PENDING', 'PAID', 'FAILED', 'CANCELLED'],
  PAYMENT_PENDING: ['PAID', 'FAILED', 'CANCELLED'],
  PAID: ['FULFILLMENT_PENDING', 'FULFILLED', 'FULFILLMENT_BLOCKED', 'REFUNDED'],
  FULFILLMENT_PENDING: ['FULFILLED', 'FULFILLMENT_BLOCKED', 'FAILED'],
  FULFILLMENT_BLOCKED: ['FULFILLMENT_PENDING', 'FULFILLED', 'FAILED'],
  CANCELLED: [],
  REFUNDED: [],
  FAILED: [],
  FULFILLED: ['REFUNDED'],
}

const PAYMENT_EDGES: Record<PaymentStatus, PaymentStatus[]> = {
  PENDING: ['AUTHORIZED', 'CAPTURED', 'FAILED', 'CANCELLED'],
  AUTHORIZED: ['CAPTURED', 'FAILED', 'CANCELLED'],
  CAPTURED: ['REFUNDED', 'PARTIALLY_REFUNDED'],
  FAILED: [],
  REFUNDED: [],
  PARTIALLY_REFUNDED: ['REFUNDED'],
  CANCELLED: [],
}

const SUBSCRIPTION_EDGES: Record<SubscriptionStatus, SubscriptionStatus[]> = {
  INCOMPLETE: ['ACTIVE', 'CANCELLED'],
  ACTIVE: ['PAST_DUE', 'CANCEL_SCHEDULED', 'CANCELLED', 'PAUSED'],
  PAST_DUE: ['ACTIVE', 'CANCELLED'],
  CANCEL_SCHEDULED: ['CANCELLED'],
  CANCELLED: [],
  PAUSED: ['ACTIVE', 'CANCELLED'],
}

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return true
  return ORDER_EDGES[from].includes(to)
}

export function canTransitionPayment(from: PaymentStatus, to: PaymentStatus): boolean {
  if (from === to) return true
  return PAYMENT_EDGES[from].includes(to)
}

export function canTransitionSubscription(from: SubscriptionStatus, to: SubscriptionStatus): boolean {
  if (from === to) return true
  return SUBSCRIPTION_EDGES[from].includes(to)
}

import { canTransitionOrder, canTransitionPayment, canTransitionSubscription } from '@/lib/platform/commerce/state'
import type { CommerceStore } from '@/lib/platform/commerce/store'
import type { CommerceActor, CommerceResult, FulfillmentRecord, OrderRecord } from '@/lib/platform/commerce/types'

function isStaff(actor: CommerceActor): boolean {
  return actor.platformRole === 'ADMIN' || actor.platformRole === 'STAFF'
}

async function authorizeCancel(
  store: CommerceStore,
  actor: CommerceActor,
  order: OrderRecord,
): Promise<CommerceResult<true>> {
  if (isStaff(actor)) return { ok: true, value: true }
  const role = await store.findBillingRole(order.billingGroupId, actor.userId)
  if (!role || (role.role !== 'GROUP_OWNER' && role.role !== 'BILLING_ADMIN')) {
    return { ok: false, error: 'FORBIDDEN' }
  }
  if (order.payerUserId && order.payerUserId !== actor.userId) {
    return { ok: false, error: 'FORBIDDEN' }
  }
  return { ok: true, value: true }
}

const CANCELLABLE: OrderRecord['status'][] = ['PENDING', 'CHECKOUT_CREATED', 'PAYMENT_PENDING']

/** Cancel an unpaid order before verified capture. Does not mutate wallet balances. */
export async function cancelUnpaidOrder(
  store: CommerceStore,
  input: { actor: CommerceActor; orderId: string; reason?: string | null },
): Promise<CommerceResult<{ orderId: string; status: OrderRecord['status'] }>> {
  const order = await store.findOrder(input.orderId)
  if (!order) return { ok: false, error: 'ORDER_NOT_FOUND' }
  const auth = await authorizeCancel(store, input.actor, order)
  if (!auth.ok) return auth
  if (!CANCELLABLE.includes(order.status)) return { ok: false, error: 'FORBIDDEN_TRANSITION' }
  const payment = await store.findPaymentByOrder(order.id)
  if (payment && payment.status === 'CAPTURED') return { ok: false, error: 'FORBIDDEN_TRANSITION' }
  if (!canTransitionOrder(order.status, 'CANCELLED')) return { ok: false, error: 'FORBIDDEN_TRANSITION' }
  const now = new Date()
  const priorStatus = order.status
  order.status = 'CANCELLED'
  order.failureCode = input.reason ?? 'CANCELLED_BY_PAYER'
  order.updatedAt = now
  await store.saveOrder(order)
  if (payment && canTransitionPayment(payment.status, 'CANCELLED')) {
    payment.status = 'CANCELLED'
    payment.updatedAt = now
    await store.savePayment(payment)
  }
  await store.appendAudit({
    id: `aud_cancel_${order.id}`,
    billingGroupId: order.billingGroupId,
    actorUserId: input.actor.userId,
    action: 'ORDER_CANCELLED',
    entityType: 'CommerceOrder',
    entityId: order.id,
    metadata: { priorStatus, reason: input.reason ?? null },
    createdAt: now,
  })
  return { ok: true, value: { orderId: order.id, status: order.status } }
}

/** After verified capture, mark recurring subscription active when provider subscription events are not yet configured. */
export async function activateSubscriptionOnInitialCapture(store: CommerceStore, orderId: string, capturedAt: Date): Promise<void> {
  const subscription = await store.findSubscriptionByOrder(orderId)
  if (!subscription || subscription.status !== 'INCOMPLETE') return
  if (!canTransitionSubscription(subscription.status, 'ACTIVE')) return
  subscription.status = 'ACTIVE'
  if (!subscription.currentPeriodStart) subscription.currentPeriodStart = capturedAt
  subscription.updatedAt = capturedAt
  await store.saveSubscription(subscription)
}

export function compensatingWalletRefundRecommended(order: OrderRecord, fulfillment: FulfillmentRecord | null): boolean {
  return order.status === 'REFUNDED' && Boolean(fulfillment?.ledgerEntryId)
}

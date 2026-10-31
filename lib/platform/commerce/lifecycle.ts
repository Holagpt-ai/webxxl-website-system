import { randomUUID } from 'crypto'
import { canTransitionSubscription } from '@/lib/platform/commerce/state'
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

/** Cancel an unpaid order using store-level CAS / transaction semantics. */
export async function cancelUnpaidOrder(
  store: CommerceStore,
  input: { actor: CommerceActor; orderId: string; reason?: string | null },
): Promise<CommerceResult<{ orderId: string; status: OrderRecord['status']; idempotent: boolean }>> {
  const order = await store.findOrder(input.orderId)
  if (!order) return { ok: false, error: 'ORDER_NOT_FOUND' }
  const auth = await authorizeCancel(store, input.actor, order)
  if (!auth.ok) return auth

  const now = new Date()
  const outcome = await store.atomicCancelUnpaidOrder({
    orderId: input.orderId,
    reason: input.reason ?? null,
    now,
  })

  if (outcome.kind === 'not_found') return { ok: false, error: 'ORDER_NOT_FOUND' }
  if (outcome.kind === 'payment_captured' || outcome.kind === 'concurrent_conflict') {
    return { ok: false, error: 'FORBIDDEN_TRANSITION', message: 'Payment is captured or cancellation lost a concurrent race.' }
  }
  if (outcome.kind === 'status_not_cancellable') {
    return { ok: false, error: 'FORBIDDEN_TRANSITION' }
  }
  if (outcome.kind === 'provider_checkout_unconfirmed') {
    return {
      ok: false,
      error: 'NOT_CONFIGURED',
      message:
        'Checkout was handed to a payment provider; cancellation cannot be confirmed locally without provider settlement evidence.',
    }
  }
  if (outcome.kind === 'already_cancelled') {
    return {
      ok: true,
      value: { orderId: outcome.order.id, status: outcome.order.status, idempotent: true },
    }
  }

  await store.appendAudit({
    id: `aud_cancel_${randomUUID().replace(/-/g, '')}`,
    billingGroupId: outcome.order.billingGroupId,
    actorUserId: input.actor.userId,
    action: 'ORDER_CANCELLED',
    entityType: 'CommerceOrder',
    entityId: outcome.order.id,
    metadata: { priorStatus: outcome.priorStatus, reason: input.reason ?? null, atomic: true },
    createdAt: now,
  })
  return {
    ok: true,
    value: { orderId: outcome.order.id, status: outcome.order.status, idempotent: false },
  }
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

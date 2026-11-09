import type {
  ManagedServiceLifecycleState,
  ManagedServiceLifecycleRow,
} from '@/lib/platform/commerce-execution/types'
import type { OrderStatus, PaymentStatus, FulfillmentStatus } from '@/lib/platform/commerce/types'

export type ManagedServiceLifecycleInput = {
  serviceKey: string
  productKey: string
  customerAccountId: string
  serviceOrderStatus?: string | null
  orderStatus?: OrderStatus | null
  paymentStatus?: PaymentStatus | null
  fulfillmentStatus?: FulfillmentStatus | null
  infraStatus?: string | null
  dataSource?: 'MANUAL' | 'PROVIDER_VERIFIED' | null
  externalProviderRef?: string | null
  commerceOrderId?: string | null
  provisioningEnabled: boolean
}

/**
 * Maps commerce + service-order + infrastructure evidence to an honest lifecycle.
 * ACTIVE requires provider-verified evidence — owning a WebXXL record is not enough.
 */
export function resolveManagedServiceLifecycle(input: ManagedServiceLifecycleInput): ManagedServiceLifecycleRow {
  const cancelled =
    input.serviceOrderStatus === 'CANCELLED' ||
    input.serviceOrderStatus === 'REJECTED' ||
    input.orderStatus === 'CANCELLED' ||
    input.infraStatus === 'CANCELLED'

  if (cancelled) {
    return row(input, 'CANCELLED', false, 'Service cancelled or rejected; no provider activation implied.')
  }

  if (
    input.orderStatus === 'FAILED' ||
    input.fulfillmentStatus === 'FAILED' ||
    input.paymentStatus === 'FAILED'
  ) {
    return row(input, 'FAILED', false, 'Payment or fulfillment failed; external resource not activated.')
  }

  const providerActivated =
    input.dataSource === 'PROVIDER_VERIFIED' &&
    Boolean(input.externalProviderRef) &&
    (input.infraStatus === 'ACTIVE' || input.infraStatus === 'VERIFIED')

  if (providerActivated) {
    return row(
      input,
      'ACTIVE',
      true,
      'Provider-verified external resource evidence present; WebXXL record and provider resource both attested.',
    )
  }

  if (input.infraStatus === 'ACTIVE' && input.dataSource !== 'PROVIDER_VERIFIED') {
    return row(
      input,
      'READY_FOR_PROVISIONING',
      false,
      'Infra row marked ACTIVE without PROVIDER_VERIFIED evidence; treated as internal readiness only.',
    )
  }

  if (
    input.paymentStatus === 'CAPTURED' &&
    (input.orderStatus === 'PAID' ||
      input.orderStatus === 'FULFILLMENT_PENDING' ||
      input.orderStatus === 'FULFILLMENT_BLOCKED' ||
      input.orderStatus === 'FULFILLED')
  ) {
    if (!input.provisioningEnabled || input.fulfillmentStatus === 'BLOCKED') {
      return row(
        input,
        'READY_FOR_PROVISIONING',
        false,
        'Verified payment captured; provisioning flag off or fulfillment blocked — no external resource claimed.',
      )
    }
    return row(
      input,
      'READY_FOR_PROVISIONING',
      false,
      'Verified payment captured; awaiting verified provider provisioning evidence.',
    )
  }

  if (input.orderStatus === 'PAYMENT_PENDING' || input.orderStatus === 'CHECKOUT_CREATED') {
    return row(input, 'PENDING_PAYMENT', false, 'Checkout created; waiting for verified payment evidence.')
  }

  if (input.serviceOrderStatus === 'APPROVED') {
    return row(input, 'PENDING_PAYMENT', false, 'Service order approved; payment not yet verified.')
  }

  if (input.serviceOrderStatus === 'QUOTED' || input.serviceOrderStatus === 'UNDER_REVIEW') {
    return row(
      input,
      input.serviceOrderStatus === 'QUOTED' ? 'QUOTED' : 'PENDING_APPROVAL',
      false,
      'Service order awaiting quote acceptance or approval; no provider activation.',
    )
  }

  if (input.serviceOrderStatus === 'REQUESTED' || input.orderStatus === 'PENDING' || !input.orderStatus) {
    return row(input, 'REQUESTED', false, 'Service requested; WebXXL record only — not an activated provider resource.')
  }

  return row(input, 'REQUESTED', false, 'Insufficient evidence for a later lifecycle state.')
}

function row(
  input: ManagedServiceLifecycleInput,
  lifecycle: ManagedServiceLifecycleState,
  providerActivated: boolean,
  note: string,
): ManagedServiceLifecycleRow {
  return {
    serviceKey: input.serviceKey,
    productKey: input.productKey,
    customerAccountId: input.customerAccountId,
    lifecycle,
    webxxlRecordPresent: Boolean(input.commerceOrderId || input.serviceOrderStatus || input.infraStatus),
    providerActivated,
    dataSource: input.dataSource ?? 'NONE',
    externalProviderRef: input.externalProviderRef ?? null,
    commerceOrderId: input.commerceOrderId ?? null,
    orderStatus: input.orderStatus ?? null,
    paymentStatus: input.paymentStatus ?? null,
    note,
  }
}

/** Reject activation claims that lack verified payment capture. */
export function assertPaymentEvidenceBeforeFulfillment(input: {
  paymentStatus: PaymentStatus | null
  orderStatus: OrderStatus | null
}): { ok: true } | { ok: false; reasonCode: 'PAYMENT_NOT_CONFIRMED'; message: string } {
  if (input.paymentStatus !== 'CAPTURED') {
    return {
      ok: false,
      reasonCode: 'PAYMENT_NOT_CONFIRMED',
      message: 'Fulfillment and managed-service activation require verified CAPTURED payment evidence.',
    }
  }
  if (
    input.orderStatus !== 'PAID' &&
    input.orderStatus !== 'FULFILLMENT_PENDING' &&
    input.orderStatus !== 'FULFILLMENT_BLOCKED' &&
    input.orderStatus !== 'FULFILLED'
  ) {
    return {
      ok: false,
      reasonCode: 'PAYMENT_NOT_CONFIRMED',
      message: 'Order is not in a paid/fulfillment state; activation blocked.',
    }
  }
  return { ok: true }
}

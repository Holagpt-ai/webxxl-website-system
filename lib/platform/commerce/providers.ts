import { createHmac, timingSafeEqual } from 'crypto'
import {
  isCommerceLiveProviderEnabled,
  isCommerceMockProviderEnabled,
  isCommerceSubscriptionProviderEnabled,
  resolveCommerceProviderKey,
  type CommerceProviderKey,
} from '@/config/commerce-backend'

export type CheckoutCreateInput = {
  orderId: string
  orderPublicId: string
  amountMinor: number
  currency: string
  idempotencyKey: string
}

export type ProviderCallResult<T> = { ok: true; value: T } | { ok: false; error: 'NOT_CONFIGURED' | 'PROVIDER_DISABLED' | 'SIGNATURE_INVALID' }

export type VerifiedWebhook = {
  externalEventId: string
  eventType: string
  sequence: number
  orderId?: string
  checkoutRef?: string
  amountMinor?: number
  currency?: string
  externalPaymentRef?: string
  externalInvoiceRef?: string
  externalSubscriptionRef?: string
  periodStart?: string
  periodEnd?: string
}

export interface BillingProvider {
  key: CommerceProviderKey
  createCheckout(input: CheckoutCreateInput): Promise<ProviderCallResult<{ externalCheckoutRef: string; expiresAt: Date }>>
  getPaymentStatus(externalPaymentRef: string): Promise<ProviderCallResult<{ status: 'PENDING' | 'CAPTURED' | 'FAILED' | 'UNKNOWN' }>>
  refund(input: { externalPaymentRef: string; amountMinor: number }): Promise<ProviderCallResult<{ externalRefundRef: string }>>
  createSubscription(input: { orderId: string; billingInterval: string }): Promise<ProviderCallResult<{ externalSubscriptionRef: string }>>
  cancelSubscription(input: { externalSubscriptionRef: string }): Promise<ProviderCallResult<{ cancelled: true }>>
  verifyWebhook(rawBody: string, signature: string | null): Promise<ProviderCallResult<VerifiedWebhook>>
}

const disabled: BillingProvider = {
  key: 'disabled',
  async createCheckout() {
    return { ok: false, error: 'PROVIDER_DISABLED' }
  },
  async getPaymentStatus() {
    return { ok: false, error: 'PROVIDER_DISABLED' }
  },
  async refund() {
    return { ok: false, error: 'PROVIDER_DISABLED' }
  },
  async createSubscription() {
    return { ok: false, error: 'NOT_CONFIGURED' }
  },
  async cancelSubscription() {
    return { ok: false, error: 'NOT_CONFIGURED' }
  },
  async verifyWebhook() {
    return { ok: false, error: 'SIGNATURE_INVALID' }
  },
}

function unconfiguredLive(key: 'stripe' | 'paddle' | 'lemon_squeezy'): BillingProvider {
  return {
    key,
    async createCheckout() {
      return { ok: false, error: 'NOT_CONFIGURED' }
    },
    async getPaymentStatus() {
      return { ok: false, error: 'NOT_CONFIGURED' }
    },
    async refund() {
      return { ok: false, error: 'NOT_CONFIGURED' }
    },
    async createSubscription() {
      return { ok: false, error: 'NOT_CONFIGURED' }
    },
    async cancelSubscription() {
      return { ok: false, error: 'NOT_CONFIGURED' }
    },
    async verifyWebhook() {
      return { ok: false, error: 'SIGNATURE_INVALID' }
    },
  }
}

export function signCommerceWebhook(rawBody: string, secret: string): string {
  return createHmac('sha256', secret).update(rawBody).digest('hex')
}

export function verifyCommerceWebhookSignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature || !secret) return false
  const expected = signCommerceWebhook(rawBody, secret)
  const left = Buffer.from(expected)
  const right = Buffer.from(signature)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

function mockWebhookSecret(): string | null {
  if (process.env.NODE_ENV === 'production') return null
  const secret = process.env.COMMERCE_MOCK_WEBHOOK_SECRET
  if (!secret) return null
  return secret
}

const mockProvider: BillingProvider = {
  key: 'mock',
  async createCheckout(input) {
    if (!isCommerceMockProviderEnabled()) return { ok: false, error: 'PROVIDER_DISABLED' }
    return {
      ok: true,
      value: {
        externalCheckoutRef: `mock_cs_${input.orderPublicId}`,
        expiresAt: new Date(Date.now() + 30 * 60_000),
      },
    }
  },
  async getPaymentStatus() {
    return { ok: true, value: { status: 'UNKNOWN' } }
  },
  async refund() {
    return { ok: false, error: 'NOT_CONFIGURED' }
  },
  async createSubscription() {
    if (!isCommerceSubscriptionProviderEnabled()) return { ok: false, error: 'NOT_CONFIGURED' }
    return { ok: false, error: 'NOT_CONFIGURED' }
  },
  async cancelSubscription() {
    if (!isCommerceSubscriptionProviderEnabled()) return { ok: false, error: 'NOT_CONFIGURED' }
    return { ok: false, error: 'NOT_CONFIGURED' }
  },
  async verifyWebhook(rawBody, signature) {
    const secret = mockWebhookSecret()
    if (!secret || !verifyCommerceWebhookSignature(rawBody, signature, secret)) {
      return { ok: false, error: 'SIGNATURE_INVALID' }
    }
    let parsed: VerifiedWebhook
    try {
      const body = JSON.parse(rawBody) as VerifiedWebhook & { id?: string }
      const externalEventId = body.externalEventId || body.id || ''
      if (!externalEventId) return { ok: false, error: 'SIGNATURE_INVALID' }
      parsed = {
        externalEventId,
        eventType: body.eventType,
        sequence: body.sequence,
        orderId: body.orderId,
        checkoutRef: body.checkoutRef,
        amountMinor: body.amountMinor,
        currency: body.currency,
        externalPaymentRef: body.externalPaymentRef,
        externalInvoiceRef: body.externalInvoiceRef,
        externalSubscriptionRef: body.externalSubscriptionRef,
        periodStart: body.periodStart,
        periodEnd: body.periodEnd,
      }
    } catch {
      return { ok: false, error: 'SIGNATURE_INVALID' }
    }
    if (!parsed.externalEventId || !parsed.eventType || !Number.isInteger(parsed.sequence)) {
      return { ok: false, error: 'SIGNATURE_INVALID' }
    }
    return { ok: true, value: parsed }
  },
}

export function getBillingProvider(requested?: string | null): BillingProvider {
  const key = resolveCommerceProviderKey(requested)
  if (key === 'mock') return mockProvider
  if (key === 'stripe' || key === 'paddle' || key === 'lemon_squeezy') {
    if (!isCommerceLiveProviderEnabled()) return disabled
    return unconfiguredLive(key)
  }
  return disabled
}

export function assertNoLiveProviderNetwork(): boolean {
  return !isCommerceLiveProviderEnabled()
}

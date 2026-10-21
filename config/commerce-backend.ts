function envFlag(name: string, defaultValue = false): boolean {
  const raw = process.env[name]
  if (raw === undefined) return defaultValue
  return raw === '1' || raw.toLowerCase() === 'true'
}

/** Commerce HTTP and service entry. Default off. */
export function isCommerceBackendEnabled(): boolean {
  return envFlag('COMMERCE_BACKEND_ENABLED', false)
}

/** Allows the mock checkout adapter outside production. Does not enable live processors. */
export function isCommerceCheckoutEnabled(): boolean {
  return envFlag('COMMERCE_CHECKOUT_ENABLED', false)
}

/**
 * Reserved for a future live processor. Live adapters stay unconfigured even when this is true.
 * No production payment account is activated by this flag.
 */
export function isCommerceLiveProviderEnabled(): boolean {
  return envFlag('COMMERCE_LIVE_PROVIDER_ENABLED', false)
}

/** Verified-payment wallet mint. Default off — production credits are not issued. */
export function isCommerceWalletMintEnabled(): boolean {
  return envFlag('COMMERCE_WALLET_MINT_ENABLED', false)
}

/** Runs fulfillment preparation after a verified capture. Does not mint credits by itself. */
export function isCommerceFulfillmentEnabled(): boolean {
  return envFlag('COMMERCE_FULFILLMENT_ENABLED', false)
}

/** Activates CustomerService / provisioning side effects. Default off. */
export function isCommerceProvisioningEnabled(): boolean {
  return envFlag('COMMERCE_PROVISIONING_ENABLED', false)
}

/** External subscription create/cancel calls. Default off. */
export function isCommerceSubscriptionProviderEnabled(): boolean {
  return envFlag('COMMERCE_SUBSCRIPTION_PROVIDER_ENABLED', false)
}

/** Applies verified webhook events to payment state. Receipts can still be stored when this is off. */
export function isCommerceWebhookProcessingEnabled(): boolean {
  return envFlag('COMMERCE_WEBHOOK_PROCESSING_ENABLED', false)
}

/** Enqueues AUTO-10 jobs. The workflow backend has its own disablement. */
export function isCommerceWorkflowEnqueueEnabled(): boolean {
  return envFlag('COMMERCE_WORKFLOW_ENQUEUE_ENABLED', false)
}

export function isCommerceMockProviderEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' && isCommerceCheckoutEnabled() && process.env.COMMERCE_PROVIDER_MODE === 'mock'
}

export type CommerceProviderKey = 'disabled' | 'mock' | 'stripe' | 'paddle' | 'lemon_squeezy'

export function resolveCommerceProviderKey(requested?: string | null): CommerceProviderKey {
  if (requested === 'mock' && isCommerceMockProviderEnabled()) return 'mock'
  if (
    (requested === 'stripe' || requested === 'paddle' || requested === 'lemon_squeezy') &&
    isCommerceLiveProviderEnabled()
  ) {
    return requested
  }
  return 'disabled'
}

import {
  isCommerceBackendEnabled,
  isCommerceCheckoutEnabled,
  isCommerceFulfillmentEnabled,
  isCommerceLiveProviderEnabled,
  isCommerceProvisioningEnabled,
  isCommerceWalletMintEnabled,
  isCommerceWebhookProcessingEnabled,
  resolveCommerceProviderKey,
  type CommerceProviderKey,
} from '@/config/commerce-backend'
import {
  PREPARATION_ONLY_CHECKOUT_BLOCKED_CODE,
  PREPARATION_ONLY_CHECKOUT_BLOCKED_MESSAGE,
} from '@/lib/platform/commerce-execution/constants'
import type { PaymentProviderReadinessSliceData } from '@/lib/platform/commerce-execution/types'

const SUPPORTED: CommerceProviderKey[] = ['disabled', 'mock', 'stripe', 'paddle', 'lemon_squeezy']

/** Provider-neutral readiness — never hard-codes a selected live processor. */
export function buildPaymentProviderReadiness(requestedProvider?: string | null): PaymentProviderReadinessSliceData {
  const resolvedProviderKey = resolveCommerceProviderKey(requestedProvider)
  return {
    commerceBackendEnabled: isCommerceBackendEnabled(),
    checkoutEnabled: isCommerceCheckoutEnabled(),
    liveProviderEnabled: isCommerceLiveProviderEnabled(),
    webhookProcessingEnabled: isCommerceWebhookProcessingEnabled(),
    fulfillmentEnabled: isCommerceFulfillmentEnabled(),
    provisioningEnabled: isCommerceProvisioningEnabled(),
    walletMintEnabled: isCommerceWalletMintEnabled(),
    resolvedProviderKey,
    liveChargeBlocked: true,
    checkoutBlockedCode: PREPARATION_ONLY_CHECKOUT_BLOCKED_CODE,
    checkoutBlockedMessage: PREPARATION_ONLY_CHECKOUT_BLOCKED_MESSAGE,
    supportedProviderKeys: SUPPORTED,
  }
}

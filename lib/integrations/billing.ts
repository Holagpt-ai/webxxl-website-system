import type { PricingPlan } from '@/config/pricing'

/**
 * INTEGRATION BOUNDARY — Billing (owned by Cursor).
 * The payment provider is not selected. The public site never references a provider.
 * Once billing exists, change getPlanActionHref to return a provider-agnostic checkout route
 * (e.g. /checkout?plan=growth) implemented by the backend.
 */
export function getPlanActionHref(plan: PricingPlan): string {
  if (plan.ctaHref) return plan.ctaHref
  const params = new URLSearchParams({ plan: plan.slug })
  if (plan.billingType === 'monthly' || plan.billingType === 'annual') params.set('billing', plan.billingType)
  return `/get-started?${params.toString()}`
}

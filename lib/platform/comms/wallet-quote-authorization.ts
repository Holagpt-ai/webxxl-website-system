import { isWalletCommsIntegrationEnabled } from '@/config/wallet-backend'
import type { CommsResult } from '@/lib/platform/comms/types'

export type CommsWalletQuoteAuthorizationInput = {
  operatingAccountId: string
  quoteCustomerAccountId: string
  billingGroupId: string
  authorizedBillingGroupIds: string[]
  siblingCustomerAccountIds: string[]
  availableCredits: number
  requiredCredits: number
  siteSpendingCapCredits?: number
  siteUsageCreditsThisPeriod?: number
  managedSiteId?: string
  ratePlanVersion: string
  estimatedUnits: number
}

function finitePositive(value: number, label: string): CommsResult<true> {
  if (!Number.isFinite(value) || value <= 0) {
    return { ok: false, code: 'FORBIDDEN', message: `Invalid ${label}` }
  }
  return { ok: true, value: true }
}

function finiteNonNegative(value: number, label: string): CommsResult<true> {
  if (!Number.isFinite(value) || value < 0) {
    return { ok: false, code: 'FORBIDDEN', message: `Invalid ${label}` }
  }
  return { ok: true, value: true }
}

/**
 * Quote → wallet authorization preparation (no ledger mutation).
 * Billing group wallet access does not grant sibling CRM/contact scopes.
 */
export function authorizeCommsWalletQuoteReservation(
  input: CommsWalletQuoteAuthorizationInput,
): CommsResult<{ authorizedCredits: number; ratePlanVersion: string }> {
  if (!isWalletCommsIntegrationEnabled()) {
    return { ok: false, code: 'NOT_CONFIGURED', message: 'Wallet/comms integration disabled' }
  }

  const ratePlan = input.ratePlanVersion?.trim()
  if (!ratePlan) {
    return { ok: false, code: 'FORBIDDEN', message: 'Invalid rate plan version' }
  }

  const units = finitePositive(input.estimatedUnits, 'estimated units')
  if (!units.ok) return units

  const required = finitePositive(input.requiredCredits, 'required credits')
  if (!required.ok) return required

  const available = finiteNonNegative(input.availableCredits, 'available credits')
  if (!available.ok) return available

  if (input.quoteCustomerAccountId !== input.operatingAccountId) {
    return { ok: false, code: 'FORBIDDEN', message: 'Quote account must match operating account' }
  }
  if (!input.authorizedBillingGroupIds.includes(input.billingGroupId)) {
    return { ok: false, code: 'FORBIDDEN', message: 'Billing group not authorized for operating account' }
  }
  if (input.availableCredits < input.requiredCredits) {
    return { ok: false, code: 'FORBIDDEN', message: 'INSUFFICIENT_BALANCE' }
  }

  if (input.siteSpendingCapCredits !== undefined) {
    const cap = finitePositive(input.siteSpendingCapCredits, 'site spending cap')
    if (!cap.ok) return cap
    if (!input.managedSiteId?.trim()) {
      return {
        ok: false,
        code: 'FORBIDDEN',
        message: 'SITE_CAP_CONTEXT_REQUIRED',
      }
    }
    if (input.siteUsageCreditsThisPeriod === undefined) {
      return {
        ok: false,
        code: 'FORBIDDEN',
        message: 'SITE_USAGE_UNAVAILABLE',
      }
    }
    const usage = finiteNonNegative(input.siteUsageCreditsThisPeriod, 'site usage credits')
    if (!usage.ok) return usage
    if (input.siteUsageCreditsThisPeriod + input.requiredCredits > input.siteSpendingCapCredits) {
      return { ok: false, code: 'FORBIDDEN', message: 'SITE_SPENDING_CAP_EXCEEDED' }
    }
  }

  return {
    ok: true,
    value: { authorizedCredits: input.requiredCredits, ratePlanVersion: ratePlan },
  }
}

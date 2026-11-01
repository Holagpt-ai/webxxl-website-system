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
  if (input.quoteCustomerAccountId !== input.operatingAccountId) {
    return { ok: false, code: 'FORBIDDEN', message: 'Quote account must match operating account' }
  }
  if (!input.authorizedBillingGroupIds.includes(input.billingGroupId)) {
    return { ok: false, code: 'FORBIDDEN', message: 'Billing group not authorized for operating account' }
  }
  if (input.requiredCredits <= 0) {
    return { ok: false, code: 'FORBIDDEN', message: 'Invalid quote credit requirement' }
  }
  if (input.availableCredits < input.requiredCredits) {
    return { ok: false, code: 'FORBIDDEN', message: 'INSUFFICIENT_BALANCE' }
  }
  if (input.siteSpendingCapCredits != null && input.managedSiteId) {
    const usage = input.siteUsageCreditsThisPeriod ?? 0
    if (usage + input.requiredCredits > input.siteSpendingCapCredits) {
      return { ok: false, code: 'FORBIDDEN', message: 'SITE_SPENDING_CAP_EXCEEDED' }
    }
  }
  return {
    ok: true,
    value: { authorizedCredits: input.requiredCredits, ratePlanVersion: input.ratePlanVersion },
  }
}

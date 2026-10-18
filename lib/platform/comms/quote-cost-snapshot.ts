import {
  estimateMessagingCostFromQuotedUnits,
  isVerifiedWalletRatePlanVersion,
} from '@/lib/platform/wallet/rate-plan'

export type CommunicationQuoteCostRow = {
  channel: string
  purpose: string
  contentHash: string | null
  recipientCount: number
  eligibleCount: number
  estimatedUnits: number
  maxApprovedCredits: number | null
  ratePlanVersion: string | null
  unitCostVersion: string | null
  detail: unknown
}

export type VerifiedQuoteCost =
  | {
      ok: true
      authorizedCredits: number
      rateVersion: string
      totalEstimatedUnits: number
      unitsPerRecipient: number
      recipientCount: number
      eligibleCount: number
      contentHash: string
    }
  | { ok: false; error: 'COST_UNAVAILABLE' }

function readDetailNumber(detail: unknown, key: string): number | null {
  if (!detail || typeof detail !== 'object') return null
  const value = (detail as Record<string, unknown>)[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function verifyQuoteUnitDimensions(quote: CommunicationQuoteCostRow): boolean {
  if (quote.recipientCount <= 0 || quote.eligibleCount <= 0) return false
  if (quote.eligibleCount > quote.recipientCount) return false
  if (quote.estimatedUnits <= 0) return false

  const unitsPerRecipient = readDetailNumber(quote.detail, 'unitsPerRecipient') ?? 1
  if (!Number.isInteger(unitsPerRecipient) || unitsPerRecipient <= 0) return false

  const expectedTotal = quote.eligibleCount * unitsPerRecipient
  if (quote.estimatedUnits !== expectedTotal) return false

  const detailTotal = readDetailNumber(quote.detail, 'totalEstimatedUnits')
  if (detailTotal != null && detailTotal !== quote.estimatedUnits) return false

  return true
}

/**
 * Server-side cost bound from the approved quote revision — never treats contentHash as message body.
 * `estimatedUnits` is aggregate total units (COMMS-06: eligibleCount × unitsPerRecipient).
 */
export function resolveVerifiedCommunicationQuoteCost(quote: CommunicationQuoteCostRow): VerifiedQuoteCost {
  if (!quote.contentHash) return { ok: false, error: 'COST_UNAVAILABLE' }
  if (!verifyQuoteUnitDimensions(quote)) return { ok: false, error: 'COST_UNAVAILABLE' }

  const rateVersion = quote.ratePlanVersion ?? quote.unitCostVersion
  if (!rateVersion || !isVerifiedWalletRatePlanVersion(rateVersion)) {
    return { ok: false, error: 'COST_UNAVAILABLE' }
  }

  const unitsPerRecipient = readDetailNumber(quote.detail, 'unitsPerRecipient') ?? 1
  const detailMax = readDetailNumber(quote.detail, 'maxAuthorizedCredits')
  const authorizedCredits = quote.maxApprovedCredits ?? detailMax ?? quote.estimatedUnits
  if (authorizedCredits <= 0) return { ok: false, error: 'COST_UNAVAILABLE' }

  const channel = quote.channel === 'EMAIL' ? 'EMAIL' : 'SMS'
  const estimate = estimateMessagingCostFromQuotedUnits({
    channel,
    providerKey: channel === 'EMAIL' ? 'resend' : 'twilio',
    purpose: quote.purpose,
    rateVersion,
    totalQuotedUnits: quote.estimatedUnits,
  })
  if (!estimate.ok) return { ok: false, error: 'COST_UNAVAILABLE' }
  if (estimate.value.estimatedTotalCredits > authorizedCredits) {
    return { ok: false, error: 'COST_UNAVAILABLE' }
  }

  return {
    ok: true,
    authorizedCredits,
    rateVersion,
    totalEstimatedUnits: quote.estimatedUnits,
    unitsPerRecipient,
    recipientCount: quote.recipientCount,
    eligibleCount: quote.eligibleCount,
    contentHash: quote.contentHash,
  }
}

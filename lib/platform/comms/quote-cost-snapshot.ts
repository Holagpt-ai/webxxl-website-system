import { estimateMessagingCostFromQuotedUnits } from '@/lib/platform/wallet/rate-plan'

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
      quotedUnits: number
      contentHash: string
      recipientCount: number
    }
  | { ok: false; error: 'COST_UNAVAILABLE' }

function readDetailNumber(detail: unknown, key: string): number | null {
  if (!detail || typeof detail !== 'object') return null
  const value = (detail as Record<string, unknown>)[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/**
 * Server-side cost bound from the approved quote revision — never treats contentHash as message body.
 */
export function resolveVerifiedCommunicationQuoteCost(quote: CommunicationQuoteCostRow): VerifiedQuoteCost {
  if (!quote.contentHash) return { ok: false, error: 'COST_UNAVAILABLE' }
  if (quote.estimatedUnits <= 0) return { ok: false, error: 'COST_UNAVAILABLE' }
  if (quote.recipientCount <= 0 || quote.eligibleCount <= 0) {
    return { ok: false, error: 'COST_UNAVAILABLE' }
  }

  const rateVersion = quote.ratePlanVersion ?? quote.unitCostVersion
  if (!rateVersion) return { ok: false, error: 'COST_UNAVAILABLE' }

  const detailMax = readDetailNumber(quote.detail, 'maxAuthorizedCredits')
  const authorizedCredits = quote.maxApprovedCredits ?? detailMax ?? quote.estimatedUnits
  if (authorizedCredits <= 0) return { ok: false, error: 'COST_UNAVAILABLE' }

  const channel = quote.channel === 'EMAIL' ? 'EMAIL' : 'SMS'
  const estimate = estimateMessagingCostFromQuotedUnits({
    channel,
    providerKey: channel === 'EMAIL' ? 'resend' : 'twilio',
    purpose: quote.purpose,
    rateVersion,
    quotedUnits: quote.estimatedUnits,
    recipientCount: quote.recipientCount,
  })
  if (!estimate.ok) return { ok: false, error: 'COST_UNAVAILABLE' }
  if (estimate.value.estimatedTotalCredits > authorizedCredits) {
    return { ok: false, error: 'COST_UNAVAILABLE' }
  }

  return {
    ok: true,
    authorizedCredits,
    rateVersion,
    quotedUnits: quote.estimatedUnits,
    contentHash: quote.contentHash,
    recipientCount: quote.recipientCount,
  }
}

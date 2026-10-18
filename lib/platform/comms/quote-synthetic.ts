import type { CrmConsentChannel, CrmConsentPurpose } from '@prisma/client'
import { buildSynthetic200ContactSegmentFixture } from '@/lib/platform/crm/test-fixtures-200'
import { COMMS_QUOTE_MAX_RECIPIENTS } from '@/config/comms-backend'

export type SyntheticQuoteCounts = {
  recipientCount: number
  eligibleCount: number
  suppressedCount: number
  unknownConsentCount: number
  invalidContactCount: number
}

/** Evaluate synthetic fixture rows in-memory (never DB lookup by synthetic IDs). */
export function evaluateSynthetic200Quote(input: {
  customerAccountId: string
  channel: CrmConsentChannel
  purpose: CrmConsentPurpose
}): SyntheticQuoteCounts {
  const fixture = buildSynthetic200ContactSegmentFixture(input.customerAccountId).slice(0, COMMS_QUOTE_MAX_RECIPIENTS)
  let eligibleCount = 0
  let suppressedCount = 0
  let unknownConsentCount = 0

  for (const contact of fixture) {
    const suppressed = contact.suppressions?.some(
      (s) => s.active && s.channel === input.channel && s.purpose === input.purpose,
    )
    if (suppressed) {
      suppressedCount += 1
      continue
    }
    const consent = contact.consents?.find((c) => c.channel === input.channel && c.purpose === input.purpose)
    if (!consent || consent.status !== 'GRANTED') {
      unknownConsentCount += 1
      if (input.purpose === 'MARKETING') continue
    }
    eligibleCount += 1
  }

  return {
    recipientCount: fixture.length,
    eligibleCount,
    suppressedCount,
    unknownConsentCount,
    invalidContactCount: 0,
  }
}

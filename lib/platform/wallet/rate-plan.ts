import type { WalletDenial } from '@/lib/platform/wallet/types'

export type MessagingCostEstimate = {
  channel: string
  providerKey: string
  destinationClass: string
  purpose: string
  estimatedUnits: number
  rateVersion: string
  creditsPerUnit: number
  estimatedTotalCredits: number
  maxAllowedCost: number
  priceSource: string
  methodology: string
  notes?: string
}

export type RateEstimateInput = {
  channel: 'SMS' | 'EMAIL' | 'WHATSAPP'
  providerKey: string
  body: string
  destinationClass?: string
  purpose?: string
  rateVersion?: string
}

/** Deterministic fixture rates — not current Twilio/Resend commercial pricing. */
const FIXTURE_RATE_VERSION = 'wallet09-fixture-v1'

const SMS_FIXTURE_CREDITS_PER_SEGMENT = 2
const EMAIL_FIXTURE_CREDITS_PER_MESSAGE = 1

function estimateSmsSegments(body: string): number {
  const isGsm7 = [...body].every((ch) => ch.charCodeAt(0) <= 127)
  const singleLimit = isGsm7 ? 160 : 70
  const concatLimit = isGsm7 ? 153 : 67
  if (body.length <= singleLimit) return 1
  return Math.ceil(body.length / concatLimit)
}

export function estimateMessagingCost(
  input: RateEstimateInput,
): { ok: true; value: MessagingCostEstimate } | { ok: false; error: Extract<WalletDenial, 'COST_UNAVAILABLE'> } {
  const purpose = input.purpose ?? 'TRANSACTIONAL'
  const destinationClass = input.destinationClass ?? 'US'

  if (input.channel === 'SMS') {
    const segments = estimateSmsSegments(input.body)
    const creditsPerUnit = SMS_FIXTURE_CREDITS_PER_SEGMENT
    const total = segments * creditsPerUnit
    return {
      ok: true,
      value: {
        channel: 'SMS',
        providerKey: input.providerKey,
        destinationClass,
        purpose,
        estimatedUnits: segments,
        rateVersion: input.rateVersion ?? FIXTURE_RATE_VERSION,
        creditsPerUnit,
        estimatedTotalCredits: total,
        maxAllowedCost: total,
        priceSource: 'wallet09-synthetic-fixture',
        methodology: 'GSM-7/UCS-2 segment heuristic with fixture credits/segment',
        notes: 'Multipart SMS may bill more than one credit unit per segment.',
      },
    }
  }

  if (input.channel === 'EMAIL') {
    const creditsPerUnit = EMAIL_FIXTURE_CREDITS_PER_MESSAGE
    return {
      ok: true,
      value: {
        channel: 'EMAIL',
        providerKey: input.providerKey,
        destinationClass,
        purpose,
        estimatedUnits: 1,
        rateVersion: input.rateVersion ?? FIXTURE_RATE_VERSION,
        creditsPerUnit,
        estimatedTotalCredits: creditsPerUnit,
        maxAllowedCost: creditsPerUnit,
        priceSource: 'wallet09-synthetic-fixture',
        methodology: 'Flat fixture credit per prepared email',
        notes: 'Some email operations may be configured at zero credits separately.',
      },
    }
  }

  if (input.channel === 'WHATSAPP') {
    return { ok: false, error: 'COST_UNAVAILABLE' }
  }

  return { ok: false, error: 'COST_UNAVAILABLE' }
}

export function listFixtureRateVersions(): { rateVersion: string; channel: string; providerKey: string }[] {
  return [
    { rateVersion: FIXTURE_RATE_VERSION, channel: 'SMS', providerKey: 'twilio' },
    { rateVersion: FIXTURE_RATE_VERSION, channel: 'EMAIL', providerKey: 'resend' },
  ]
}

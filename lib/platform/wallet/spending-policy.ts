import type { Prisma } from '@prisma/client'
import {
  reservationOpenHoldAmount,
  OPEN_HOLD_STATUSES,
  type BalanceReservationSlice,
} from '@/lib/platform/wallet/balance'

export type SpendingPolicyRow = {
  dailyLimit: number | null
  monthlyLimit: number | null
  managedSiteDailyLimit: number | null
  maxCampaignCredits: number | null
  groupHardCap: number | null
  allowedChannels: Prisma.JsonValue
  policyTimezone: string
}

export type PolicyUsageContext = {
  at: Date
  accountSettledCredits: number
  accountOpenHolds: number
  siteSettledCredits?: number
  siteOpenHolds?: number
  groupSettledCredits?: number
  groupOpenHolds?: number
}

export type PolicyDenial = 'POLICY_CAP_EXCEEDED' | 'CHANNEL_NOT_ALLOWED'

function channelAllowed(policy: SpendingPolicyRow, channel?: string | null): boolean {
  if (!channel) return true
  const raw = policy.allowedChannels
  if (!raw || !Array.isArray(raw)) return true
  return raw.map(String).includes(channel)
}

function startOfUtcDay(at: Date): Date {
  return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()))
}

function startOfUtcMonth(at: Date): Date {
  return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1))
}

/** Period usage includes settled debits plus outstanding holds (reservation accounting). */
export function evaluateSpendingPolicy(input: {
  policy: SpendingPolicyRow | null
  channel?: string | null
  requestedCredits: number
  context: PolicyUsageContext
}): { ok: true } | { ok: false; error: PolicyDenial } {
  const policy = input.policy
  if (!policy) return { ok: true }
  if (!channelAllowed(policy, input.channel)) return { ok: false, error: 'CHANNEL_NOT_ALLOWED' }
  if (policy.maxCampaignCredits != null && input.requestedCredits > policy.maxCampaignCredits) {
    return { ok: false, error: 'POLICY_CAP_EXCEEDED' }
  }
  const projectedAccount = input.context.accountSettledCredits + input.context.accountOpenHolds + input.requestedCredits
  if (policy.dailyLimit != null && projectedAccount > policy.dailyLimit) {
    return { ok: false, error: 'POLICY_CAP_EXCEEDED' }
  }
  if (policy.monthlyLimit != null && projectedAccount > policy.monthlyLimit) {
    return { ok: false, error: 'POLICY_CAP_EXCEEDED' }
  }
  if (input.context.siteSettledCredits != null && policy.managedSiteDailyLimit != null) {
    const siteTotal =
      input.context.siteSettledCredits + (input.context.siteOpenHolds ?? 0) + input.requestedCredits
    if (siteTotal > policy.managedSiteDailyLimit) return { ok: false, error: 'POLICY_CAP_EXCEEDED' }
  }
  if (policy.groupHardCap != null && input.context.groupSettledCredits != null) {
    const groupTotal =
      input.context.groupSettledCredits + (input.context.groupOpenHolds ?? 0) + input.requestedCredits
    if (groupTotal > policy.groupHardCap) return { ok: false, error: 'POLICY_CAP_EXCEEDED' }
  }
  return { ok: true }
}

export function sumOpenHoldsForReservations(
  reservations: BalanceReservationSlice[],
  at: Date,
): number {
  return reservations.reduce((sum, item) => {
    if (!OPEN_HOLD_STATUSES.includes(item.status)) return sum
    return sum + reservationOpenHoldAmount(item, at)
  }, 0)
}

export { startOfUtcDay, startOfUtcMonth }

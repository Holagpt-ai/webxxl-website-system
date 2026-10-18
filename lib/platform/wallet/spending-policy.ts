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
  hasManagedSiteScope: boolean
  accountDailySettled: number
  accountDailyOpenHolds: number
  accountMonthlySettled: number
  accountMonthlyOpenHolds: number
  siteDailySettled: number
  siteDailyOpenHolds: number
  groupSettledInMonth: number
  groupOpenHolds: number
}

export type PolicyDenial = 'POLICY_CAP_EXCEEDED' | 'CHANNEL_NOT_ALLOWED' | 'POLICY_TIMEZONE_UNSUPPORTED'

function channelAllowed(policy: SpendingPolicyRow, channel?: string | null): boolean {
  if (!channel) return true
  const raw = policy.allowedChannels
  if (!raw || !Array.isArray(raw)) return true
  return raw.map(String).includes(channel)
}

type ZonedParts = { year: number; month: number; day: number }

function zonedDateParts(at: Date, timeZone: string): ZonedParts | null {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    const parts = formatter.formatToParts(at)
    const year = Number(parts.find((p) => p.type === 'year')?.value)
    const month = Number(parts.find((p) => p.type === 'month')?.value)
    const day = Number(parts.find((p) => p.type === 'day')?.value)
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null
    return { year, month, day }
  } catch {
    return null
  }
}

/** Start of calendar day/month in policy timezone, expressed as UTC instant lower bound. */
export function getPolicyPeriodStarts(
  at: Date,
  timeZone: string,
): { ok: true; dayStartUtc: Date; monthStartUtc: Date } | { ok: false; error: 'POLICY_TIMEZONE_UNSUPPORTED' } {
  const parts = zonedDateParts(at, timeZone)
  if (!parts) return { ok: false, error: 'POLICY_TIMEZONE_UNSUPPORTED' }
  const dayStartUtc = new Date(Date.UTC(parts.year, parts.month - 1, parts.day))
  const monthStartUtc = new Date(Date.UTC(parts.year, parts.month - 1, 1))
  return { ok: true, dayStartUtc, monthStartUtc }
}

export function sumSettledCredits(entries: { deltaCredits: number; effectiveAt: Date }[], from: Date): number {
  return entries
    .filter((entry) => entry.effectiveAt >= from)
    .reduce((sum, entry) => sum + Math.abs(Math.min(0, entry.deltaCredits)), 0)
}

export function sumOpenHoldsForReservations(
  reservations: (BalanceReservationSlice & { createdAt?: Date })[],
  at: Date,
  from?: Date,
): number {
  return reservations.reduce((sum, item) => {
    if (!OPEN_HOLD_STATUSES.includes(item.status)) return sum
    if (from && item.createdAt && item.createdAt < from) return sum
    return sum + reservationOpenHoldAmount(item, at)
  }, 0)
}

/** Period usage includes settled debits plus outstanding holds created in the period. */
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

  const projectedDailyAccount =
    input.context.accountDailySettled + input.context.accountDailyOpenHolds + input.requestedCredits
  if (policy.dailyLimit != null && projectedDailyAccount > policy.dailyLimit) {
    return { ok: false, error: 'POLICY_CAP_EXCEEDED' }
  }

  const projectedMonthlyAccount =
    input.context.accountMonthlySettled + input.context.accountMonthlyOpenHolds + input.requestedCredits
  if (policy.monthlyLimit != null && projectedMonthlyAccount > policy.monthlyLimit) {
    return { ok: false, error: 'POLICY_CAP_EXCEEDED' }
  }

  if (policy.managedSiteDailyLimit != null && input.context.hasManagedSiteScope) {
    const siteTotal =
      input.context.siteDailySettled + input.context.siteDailyOpenHolds + input.requestedCredits
    if (siteTotal > policy.managedSiteDailyLimit) return { ok: false, error: 'POLICY_CAP_EXCEEDED' }
  }

  if (policy.groupHardCap != null) {
    const groupTotal = input.context.groupSettledInMonth + input.context.groupOpenHolds + input.requestedCredits
    if (groupTotal > policy.groupHardCap) return { ok: false, error: 'POLICY_CAP_EXCEEDED' }
  }

  return { ok: true }
}

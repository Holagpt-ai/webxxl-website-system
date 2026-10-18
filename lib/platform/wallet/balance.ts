import type { CreditReservationStatus, WalletBalance } from '@/lib/platform/wallet/types'

export const OPEN_HOLD_STATUSES: CreditReservationStatus[] = ['HELD', 'PARTIALLY_SETTLED']

export type BalanceReservationSlice = {
  amount: number
  settledAmount: number
  status: CreditReservationStatus
  expiresAt: Date
}

export type BalanceLedgerSlice = {
  deltaCredits: number
}

export function reservationOpenHoldAmount(reservation: BalanceReservationSlice, at: Date): number {
  if (!OPEN_HOLD_STATUSES.includes(reservation.status)) return 0
  if (reservation.expiresAt <= at) return 0
  return Math.max(0, reservation.amount - reservation.settledAmount)
}

export function computeWalletBalanceFromSlices(input: {
  walletId: string
  billingGroupId: string
  ledger: BalanceLedgerSlice[]
  reservations: BalanceReservationSlice[]
  at: Date
}): WalletBalance {
  const postedBalance = input.ledger.reduce((sum, entry) => sum + entry.deltaCredits, 0)
  const reservedBalance = input.reservations.reduce(
    (sum, item) => sum + reservationOpenHoldAmount(item, input.at),
    0,
  )
  return {
    walletId: input.walletId,
    billingGroupId: input.billingGroupId,
    postedBalance,
    reservedBalance,
    availableBalance: postedBalance - reservedBalance,
  }
}

export function reservationAcceptsNewSettlement(reservation: BalanceReservationSlice, at: Date): boolean {
  if (!OPEN_HOLD_STATUSES.includes(reservation.status)) return false
  if (reservation.expiresAt <= at) return false
  return reservation.amount - reservation.settledAmount > 0
}

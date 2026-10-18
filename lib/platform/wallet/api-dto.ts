import type { WalletBalance } from '@/lib/platform/wallet/types'

export type WalletBalanceDto = {
  postedCredits: number
  heldCredits: number
  availableCredits: number
  creditType: string
  asOf: string
  billingGroupId: string
  walletId: string
}

export function toWalletBalanceDto(balance: WalletBalance, creditType: string): WalletBalanceDto {
  return {
    postedCredits: balance.postedBalance,
    heldCredits: balance.reservedBalance,
    availableCredits: balance.availableBalance,
    creditType,
    asOf: new Date().toISOString(),
    billingGroupId: balance.billingGroupId,
    walletId: balance.walletId,
  }
}

export type WalletUsageAccountDto = {
  customerAccountId: string
  settledCredits: number
}

export type WalletLedgerEntryDto = {
  id: string
  type: string
  deltaCredits: number
  customerAccountId: string | null
  managedSiteId: string | null
  reservationId: string | null
  priceVersion: string
  effectiveAt: string
}

export type WalletReservationDto = {
  id: string
  originAccountId: string
  amount: number
  settledAmount: number
  status: string
  expiresAt: string
  channel: string | null
}

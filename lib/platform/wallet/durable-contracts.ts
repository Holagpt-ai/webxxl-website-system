import type { WalletMutationPrincipal } from '@/lib/platform/wallet/mutation-principal'

export type DurableReserveCreditsInput = {
  principal: WalletMutationPrincipal
  billingGroupId: string
  customerAccountId: string
  managedSiteId?: string
  channel?: string
  usagePurpose?: string
  rateVersion?: string
  amount: number
  campaignId?: string
  correlationId: string
  idempotencyKey: string
  expiresAt: Date
  at?: Date
}

export type DurableSettleCreditsInput = {
  principal: WalletMutationPrincipal
  reservationId: string
  amount: number
  providerRef?: string
  idempotencyKey: string
  managedSiteId?: string
  campaignId?: string
}

export type DurableReleaseCreditsInput = {
  principal: WalletMutationPrincipal
  reservationId: string
  idempotencyKey: string
}

export type DurableRefundCreditsInput = {
  principal: WalletMutationPrincipal
  walletId: string
  amount: number
  originalLedgerId: string
  idempotencyKey: string
  priceVersion?: string
  refundReason?: string
}

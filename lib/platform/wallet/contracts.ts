import type {
  BillingGroupMembershipRecord,
  BillingGroupRecord,
  BillingGroupRoleRecord,
  CreditReservationRecord,
  CreditWalletRecord,
  MessageUsageRecord,
  SiteSpendingPolicyRecord,
  WalletBalance,
  WalletLedgerEntryRecord,
  WalletResult,
} from '@/lib/platform/wallet/types'

export type ReserveCreditsInput = {
  actorUserId: string
  billingGroupId: string
  customerAccountId: string
  managedSiteId?: string
  amount: number
  campaignId?: string
  correlationId: string
  idempotencyKey: string
  expiresAt: Date
  at?: Date
}

export type SettleCreditsInput = {
  actorUserId: string
  reservationId: string
  amount: number
  providerRef?: string
  idempotencyKey: string
  managedSiteId?: string
  campaignId?: string
}

export type ReleaseCreditsInput = {
  actorUserId: string
  reservationId: string
  idempotencyKey: string
}

export type RefundCreditsInput = {
  actorUserId: string
  walletId: string
  customerAccountId?: string
  amount: number
  originalLedgerId?: string
  idempotencyKey: string
  priceVersion?: string
}

export type WalletContracts = {
  lookupGroupWallet(billingGroupId: string, creditType?: string): CreditWalletRecord | null
  canAccountUseWallet(customerAccountId: string, billingGroupId: string, at?: Date): boolean
  canViewBalance(userId: string, billingGroupId: string): boolean
  getBalance(userId: string, billingGroupId: string): WalletResult<WalletBalance>
  accountUsage(customerAccountId: string, billingGroupId: string): number
  reserve(input: ReserveCreditsInput): WalletResult<CreditReservationRecord>
  settle(input: SettleCreditsInput): WalletResult<WalletLedgerEntryRecord>
  release(input: ReleaseCreditsInput): WalletResult<CreditReservationRecord>
  refund(input: RefundCreditsInput): WalletResult<WalletLedgerEntryRecord>
}

export type PlatformStoreSnapshot = {
  groups: BillingGroupRecord[]
  memberships: BillingGroupMembershipRecord[]
  roles: BillingGroupRoleRecord[]
  wallets: CreditWalletRecord[]
  ledger: WalletLedgerEntryRecord[]
  reservations: CreditReservationRecord[]
  policies: SiteSpendingPolicyRecord[]
  usage: MessageUsageRecord[]
}

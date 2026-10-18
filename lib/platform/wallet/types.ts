export type BillingGroupStatus = 'ACTIVE' | 'SUSPENDED' | 'CLOSED'
export type BillingGroupMembershipStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'UNLINKED'
export type BillingGroupRoleKind = 'GROUP_OWNER' | 'BILLING_ADMIN' | 'BILLING_VIEWER'
export type CreditWalletStatus = 'ACTIVE' | 'FROZEN' | 'CLOSED'
export type WalletLedgerEntryType = 'TOP_UP' | 'SETTLE' | 'RELEASE' | 'REFUND' | 'ADJUSTMENT'
export type CreditReservationStatus = 'HELD' | 'PARTIALLY_SETTLED' | 'SETTLED' | 'RELEASED' | 'EXPIRED'
export type MessageUsageStatus = 'QUOTED' | 'RESERVED' | 'SETTLED' | 'RELEASED'

export type BillingGroupRecord = {
  id: string
  name: string
  slug: string
  status: BillingGroupStatus
  defaultCurrency: string
  billingPolicyVersion: string
}

export type BillingGroupMembershipRecord = {
  id: string
  billingGroupId: string
  customerAccountId: string
  status: BillingGroupMembershipStatus
  validFrom: Date
  validTo: Date | null
  authorizedByUserId: string | null
  walletUseAllowed: boolean
  spendingPolicyId: string | null
  activeFundingKey: string | null
}

export type BillingGroupRoleRecord = {
  id: string
  billingGroupId: string
  userId: string
  role: BillingGroupRoleKind
}

export type BillingProfileRecord = {
  id: string
  billingGroupId: string
  legalPayerName: string
  currency: string
  defaultMethodRef: string | null
}

export type SiteSpendingPolicyRecord = {
  id: string
  billingGroupId: string
  customerAccountId: string
  managedSiteId?: string | null
  dailyLimit: number | null
  monthlyLimit: number | null
  managedSiteDailyLimit?: number | null
  maxCampaignCredits: number | null
  groupHardCap?: number | null
  allowedChannels: string[]
  policyTimezone?: string
}

export type CreditWalletRecord = {
  id: string
  billingGroupId: string
  creditType: string
  unit: string
  status: CreditWalletStatus
  ledgerSequence: number
}

export type WalletLedgerEntryRecord = {
  id: string
  walletId: string
  customerAccountId: string | null
  managedSiteId: string | null
  campaignId: string | null
  type: WalletLedgerEntryType
  deltaCredits: number
  priceVersion: string
  reservationId: string | null
  providerRef: string | null
  originalLedgerEntryId?: string | null
  refundReason?: string | null
  idempotencyKey: string
  effectiveAt: Date
  actorUserId: string | null
}

export type CreditReservationRecord = {
  id: string
  walletId: string
  originAccountId: string
  managedSiteId?: string | null
  channel?: string | null
  usagePurpose?: string | null
  rateVersion?: string | null
  requestFingerprint?: string | null
  amount: number
  settledAmount: number
  status: CreditReservationStatus
  expiresAt: Date
  correlationId: string
  campaignId: string | null
  idempotencyKey: string
}

export type MessageUsageRecord = {
  id: string
  billingGroupId: string
  customerAccountId: string
  managedSiteId: string | null
  walletId: string
  reservationId: string | null
  channel: string
  units: number
  credits: number
  status: MessageUsageStatus
  idempotencyKey: string
}

export type WalletBalance = {
  walletId: string
  billingGroupId: string
  postedBalance: number
  reservedBalance: number
  availableBalance: number
}

export type WalletDenial =
  | 'WALLET_NOT_FOUND'
  | 'WALLET_INACTIVE'
  | 'UNAUTHORIZED_BALANCE'
  | 'UNAUTHORIZED_SPEND'
  | 'UNAUTHORIZED_SETTLE'
  | 'ACCOUNT_NOT_FUNDED'
  | 'INSUFFICIENT_CREDITS'
  | 'INVALID_AMOUNT'
  | 'RESERVATION_NOT_FOUND'
  | 'RESERVATION_NOT_HELD'
  | 'RESERVATION_EXPIRED'
  | 'FORGED_SERVICE_ACTOR'
  | 'IDEMPOTENCY_CONFLICT'
  | 'POLICY_CAP_EXCEEDED'
  | 'CHANNEL_NOT_ALLOWED'
  | 'WALLET_FROZEN'
  | 'COST_UNAVAILABLE'
  | 'POLICY_TIMEZONE_UNSUPPORTED'
  | 'QUOTE_UNAVAILABLE'

export type WalletResult<T> = { ok: true; value: T } | { ok: false; error: WalletDenial }

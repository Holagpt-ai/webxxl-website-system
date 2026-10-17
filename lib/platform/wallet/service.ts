import {
  canAccountSpendFromGroup,
  canViewGroupWallet,
  isEffectiveFundingMembership,
  resolveAccountBillingGroup,
  type FundingMembership,
} from '@/lib/platform/billing-authz'
import type {
  ReleaseCreditsInput,
  RefundCreditsInput,
  ReserveCreditsInput,
  SettleCreditsInput,
  WalletContracts,
} from '@/lib/platform/wallet/contracts'
import type { InMemoryPlatformStore } from '@/lib/platform/wallet/in-memory-store'
import { nextId } from '@/lib/platform/wallet/in-memory-store'
import type {
  BillingGroupMembershipRecord,
  CreditReservationRecord,
  CreditWalletRecord,
  WalletBalance,
  WalletLedgerEntryRecord,
  WalletResult,
} from '@/lib/platform/wallet/types'

function asFunding(store: InMemoryPlatformStore): FundingMembership[] {
  return store.memberships.map((item) => ({
    billingGroupId: item.billingGroupId,
    customerAccountId: item.customerAccountId,
    status: item.status,
    validFrom: item.validFrom,
    validTo: item.validTo,
    walletUseAllowed: item.walletUseAllowed,
  }))
}

function computeBalance(store: InMemoryPlatformStore, wallet: CreditWalletRecord, at: Date): WalletBalance {
  const postedBalance = store.ledger
    .filter((entry) => entry.walletId === wallet.id)
    .reduce((sum, entry) => sum + entry.deltaCredits, 0)
  const reservedBalance = store.reservations
    .filter((item) => item.walletId === wallet.id && item.status === 'HELD' && item.expiresAt > at)
    .reduce((sum, item) => sum + (item.amount - item.settledAmount), 0)
  return {
    walletId: wallet.id,
    billingGroupId: wallet.billingGroupId,
    postedBalance,
    reservedBalance,
    availableBalance: postedBalance - reservedBalance,
  }
}

function findWallet(
  store: InMemoryPlatformStore,
  billingGroupId: string,
  creditType = 'MESSAGING',
): CreditWalletRecord | undefined {
  return [...store.wallets.values()].find(
    (wallet) => wallet.billingGroupId === billingGroupId && wallet.creditType === creditType,
  )
}

export function createWalletContractService(store: InMemoryPlatformStore): WalletContracts {
  return {
    lookupGroupWallet(billingGroupId, creditType = 'MESSAGING') {
      return findWallet(store, billingGroupId, creditType) ?? null
    },

    canAccountUseWallet(customerAccountId, billingGroupId, at = new Date()) {
      return canAccountSpendFromGroup(asFunding(store), customerAccountId, billingGroupId, at)
    },

    canViewBalance(userId, billingGroupId) {
      return canViewGroupWallet(store.roles, userId, billingGroupId)
    },

    getBalance(userId, billingGroupId) {
      if (!canViewGroupWallet(store.roles, userId, billingGroupId)) {
        return { ok: false, error: 'UNAUTHORIZED_BALANCE' }
      }
      const wallet = findWallet(store, billingGroupId)
      if (!wallet) return { ok: false, error: 'WALLET_NOT_FOUND' }
      if (wallet.status !== 'ACTIVE') return { ok: false, error: 'WALLET_INACTIVE' }
      return { ok: true, value: computeBalance(store, wallet, new Date()) }
    },

    accountUsage(customerAccountId, billingGroupId) {
      const wallet = findWallet(store, billingGroupId)
      if (!wallet) return 0
      return store.ledger
        .filter(
          (entry) =>
            entry.walletId === wallet.id &&
            entry.customerAccountId === customerAccountId &&
            entry.deltaCredits < 0,
        )
        .reduce((sum, entry) => sum + Math.abs(entry.deltaCredits), 0)
    },

    reserve(input) {
      const at = input.at ?? new Date()
      const existing = store.reservations.find((item) => item.idempotencyKey === input.idempotencyKey)
      if (existing) {
        if (existing.originAccountId !== input.customerAccountId || existing.amount !== input.amount) {
          return { ok: false, error: 'IDEMPOTENCY_CONFLICT' }
        }
        return { ok: true, value: existing }
      }
      if (!canAccountSpendFromGroup(asFunding(store), input.customerAccountId, input.billingGroupId, at)) {
        return { ok: false, error: 'ACCOUNT_NOT_FUNDED' }
      }
      const wallet = findWallet(store, input.billingGroupId)
      if (!wallet || wallet.status !== 'ACTIVE') return { ok: false, error: 'WALLET_NOT_FOUND' }
      const policy = store.policies.find(
        (item) => item.billingGroupId === input.billingGroupId && item.customerAccountId === input.customerAccountId,
      )
      if (policy?.maxCampaignCredits != null && input.amount > policy.maxCampaignCredits) {
        return { ok: false, error: 'POLICY_CAP_EXCEEDED' }
      }
      const balance = computeBalance(store, wallet, at)
      if (input.amount > balance.availableBalance) return { ok: false, error: 'INSUFFICIENT_CREDITS' }
      const reservation: CreditReservationRecord = {
        id: nextId('res'),
        walletId: wallet.id,
        originAccountId: input.customerAccountId,
        amount: input.amount,
        settledAmount: 0,
        status: 'HELD',
        expiresAt: input.expiresAt,
        correlationId: input.correlationId,
        campaignId: input.campaignId ?? null,
        idempotencyKey: input.idempotencyKey,
      }
      store.reservations.push(reservation)
      store.usage.push({
        id: nextId('use'),
        billingGroupId: input.billingGroupId,
        customerAccountId: input.customerAccountId,
        managedSiteId: input.managedSiteId ?? null,
        walletId: wallet.id,
        reservationId: reservation.id,
        channel: 'SMS',
        units: input.amount,
        credits: input.amount,
        status: 'RESERVED',
        idempotencyKey: `usage_${input.idempotencyKey}`,
      })
      return { ok: true, value: reservation }
    },

    settle(input) {
      const existingLedger = store.ledger.find((entry) => entry.idempotencyKey === input.idempotencyKey)
      if (existingLedger) return { ok: true, value: existingLedger }
      const reservation = store.reservations.find((item) => item.id === input.reservationId)
      if (!reservation) return { ok: false, error: 'RESERVATION_NOT_FOUND' }
      if (reservation.status !== 'HELD' && reservation.status !== 'PARTIALLY_SETTLED') {
        return { ok: false, error: 'RESERVATION_NOT_HELD' }
      }
      const remaining = reservation.amount - reservation.settledAmount
      if (input.amount > remaining) return { ok: false, error: 'INSUFFICIENT_CREDITS' }
      reservation.settledAmount += input.amount
      reservation.status = reservation.settledAmount >= reservation.amount ? 'SETTLED' : 'PARTIALLY_SETTLED'
      const wallet = store.wallets.get(reservation.walletId)
      if (!wallet) return { ok: false, error: 'WALLET_NOT_FOUND' }
      wallet.ledgerSequence += 1
      const entry: WalletLedgerEntryRecord = {
        id: nextId('led'),
        walletId: reservation.walletId,
        customerAccountId: reservation.originAccountId,
        managedSiteId: input.managedSiteId ?? null,
        campaignId: input.campaignId ?? reservation.campaignId,
        type: 'SETTLE',
        deltaCredits: -input.amount,
        priceVersion: 'found01-synthetic-v1',
        reservationId: reservation.id,
        providerRef: input.providerRef ?? null,
        idempotencyKey: input.idempotencyKey,
        effectiveAt: new Date(),
        actorUserId: input.actorUserId,
      }
      store.ledger.push(entry)
      const usage = store.usage.find((item) => item.reservationId === reservation.id)
      if (usage) usage.status = reservation.status === 'SETTLED' ? 'SETTLED' : 'RESERVED'
      return { ok: true, value: entry }
    },

    release(input) {
      const reservation = store.reservations.find((item) => item.id === input.reservationId)
      if (!reservation) return { ok: false, error: 'RESERVATION_NOT_FOUND' }
      if (reservation.status === 'RELEASED') return { ok: true, value: reservation }
      if (reservation.status === 'SETTLED') return { ok: false, error: 'RESERVATION_NOT_HELD' }
      reservation.status = reservation.settledAmount > 0 ? 'SETTLED' : 'RELEASED'
      const unused = reservation.amount - reservation.settledAmount
      if (unused > 0 && reservation.status === 'RELEASED') {
        const existing = store.ledger.find((entry) => entry.idempotencyKey === input.idempotencyKey)
        if (!existing) {
          store.ledger.push({
            id: nextId('led'),
            walletId: reservation.walletId,
            customerAccountId: reservation.originAccountId,
            managedSiteId: null,
            campaignId: reservation.campaignId,
            type: 'RELEASE',
            deltaCredits: 0,
            priceVersion: 'found01-synthetic-v1',
            reservationId: reservation.id,
            providerRef: null,
            idempotencyKey: input.idempotencyKey,
            effectiveAt: new Date(),
            actorUserId: input.actorUserId,
          })
        }
      }
      const usage = store.usage.find((item) => item.reservationId === reservation.id)
      if (usage && reservation.status === 'RELEASED') usage.status = 'RELEASED'
      return { ok: true, value: reservation }
    },

    refund(input) {
      const existing = store.ledger.find((entry) => entry.idempotencyKey === input.idempotencyKey)
      if (existing) return { ok: true, value: existing }
      const wallet = store.wallets.get(input.walletId)
      if (!wallet || wallet.status !== 'ACTIVE') return { ok: false, error: 'WALLET_NOT_FOUND' }
      wallet.ledgerSequence += 1
      const entry: WalletLedgerEntryRecord = {
        id: nextId('led'),
        walletId: wallet.id,
        customerAccountId: input.customerAccountId ?? null,
        managedSiteId: null,
        campaignId: null,
        type: 'REFUND',
        deltaCredits: input.amount,
        priceVersion: input.priceVersion ?? 'found01-synthetic-v1',
        reservationId: input.originalLedgerId ?? null,
        providerRef: null,
        idempotencyKey: input.idempotencyKey,
        effectiveAt: new Date(),
        actorUserId: input.actorUserId,
      }
      store.ledger.push(entry)
      return { ok: true, value: entry }
    },
  }
}

export function seedWalletTopUp(
  store: InMemoryPlatformStore,
  billingGroupId: string,
  amount: number,
  idempotencyKey: string,
): WalletResult<WalletLedgerEntryRecord> {
  const wallet = findWallet(store, billingGroupId)
  if (!wallet) return { ok: false, error: 'WALLET_NOT_FOUND' }
  const existing = store.ledger.find((entry) => entry.idempotencyKey === idempotencyKey)
  if (existing) return { ok: true, value: existing }
  wallet.ledgerSequence += 1
  const entry: WalletLedgerEntryRecord = {
    id: nextId('led'),
    walletId: wallet.id,
    customerAccountId: null,
    managedSiteId: null,
    campaignId: null,
    type: 'TOP_UP',
    deltaCredits: amount,
    priceVersion: 'found01-synthetic-v1',
    reservationId: null,
    providerRef: 'synthetic-test',
    idempotencyKey,
    effectiveAt: new Date(),
    actorUserId: null,
  }
  store.ledger.push(entry)
  return { ok: true, value: entry }
}

export function unlinkAccountFromGroup(
  store: InMemoryPlatformStore,
  customerAccountId: string,
  billingGroupId: string,
  at: Date,
): BillingGroupMembershipRecord | null {
  const membership = store.memberships.find(
    (item) => item.customerAccountId === customerAccountId && item.billingGroupId === billingGroupId,
  )
  if (!membership) return null
  membership.status = 'UNLINKED'
  membership.validTo = at
  membership.activeFundingKey = null
  membership.walletUseAllowed = false
  return membership
}

export function resolveFundedGroupId(
  store: InMemoryPlatformStore,
  customerAccountId: string,
  at = new Date(),
): string | null {
  return resolveAccountBillingGroup(asFunding(store), customerAccountId, at)
}

export function listHistoricalCharges(
  store: InMemoryPlatformStore,
  billingGroupId: string,
  customerAccountId: string,
): WalletLedgerEntryRecord[] {
  const wallet = findWallet(store, billingGroupId)
  if (!wallet) return []
  return store.ledger.filter(
    (entry) => entry.walletId === wallet.id && entry.customerAccountId === customerAccountId && entry.type === 'SETTLE',
  )
}

export { isEffectiveFundingMembership }

import {
  canAccountSpendFromGroup,
  isEffectiveFundingMembership,
  resolveAccountBillingGroup,
  type FundingMembership,
} from '@/lib/platform/billing-authz'
import {
  canInitiateAccountWalletUsage,
  canPerformPrivilegedWalletOperation,
  canViewWalletBalance,
  resolveWalletActor,
  type WalletActor,
} from '@/lib/platform/wallet/authorization'
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
  CreditReservationStatus,
  CreditWalletRecord,
  WalletBalance,
  WalletLedgerEntryRecord,
  WalletResult,
} from '@/lib/platform/wallet/types'
import { validateCreditAmount } from '@/lib/platform/wallet/validation'

const OPEN_HOLD_STATUSES: CreditReservationStatus[] = ['HELD', 'PARTIALLY_SETTLED']

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

/** Unsettled hold for an open reservation; expired holds release availability without deleting history. */
export function reservationOpenHoldAmount(reservation: CreditReservationRecord, at: Date): number {
  if (!OPEN_HOLD_STATUSES.includes(reservation.status)) return 0
  if (reservation.expiresAt <= at) return 0
  return Math.max(0, reservation.amount - reservation.settledAmount)
}

export function computeWalletBalance(
  store: InMemoryPlatformStore,
  wallet: CreditWalletRecord,
  at: Date,
): WalletBalance {
  const postedBalance = store.ledger
    .filter((entry) => entry.walletId === wallet.id)
    .reduce((sum, entry) => sum + entry.deltaCredits, 0)
  const reservedBalance = store.reservations
    .filter((item) => item.walletId === wallet.id)
    .reduce((sum, item) => sum + reservationOpenHoldAmount(item, at), 0)
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

function walletForReservation(store: InMemoryPlatformStore, reservation: CreditReservationRecord) {
  const wallet = store.wallets.get(reservation.walletId)
  if (!wallet) return null
  return wallet
}

export function reservationAcceptsNewSettlement(reservation: CreditReservationRecord, at: Date): boolean {
  if (!OPEN_HOLD_STATUSES.includes(reservation.status)) return false
  if (reservation.expiresAt <= at) return false
  return reservation.amount - reservation.settledAmount > 0
}

export function expireHeldReservations(store: InMemoryPlatformStore, at: Date): CreditReservationRecord[] {
  const expired: CreditReservationRecord[] = []
  for (const reservation of store.reservations) {
    if (!OPEN_HOLD_STATUSES.includes(reservation.status)) continue
    if (reservation.expiresAt > at) continue
    reservation.status = 'EXPIRED'
    const usage = store.usage.find((item) => item.reservationId === reservation.id)
    if (usage) usage.status = 'RELEASED'
    expired.push(reservation)
  }
  return expired
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
      return canViewWalletBalance(store, store.roles, { actorId: userId, actorType: 'USER' }, billingGroupId)
    },

    getBalance(userId, billingGroupId) {
      if (!canViewWalletBalance(store, store.roles, { actorId: userId, actorType: 'USER' }, billingGroupId)) {
        return { ok: false, error: 'UNAUTHORIZED_BALANCE' }
      }
      const wallet = findWallet(store, billingGroupId)
      if (!wallet) return { ok: false, error: 'WALLET_NOT_FOUND' }
      if (wallet.status !== 'ACTIVE') return { ok: false, error: 'WALLET_INACTIVE' }
      return { ok: true, value: computeWalletBalance(store, wallet, new Date()) }
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
      const amountCheck = validateCreditAmount(input.amount)
      if (!amountCheck.ok) return { ok: false, error: 'INVALID_AMOUNT' }
      if (input.expiresAt <= at) return { ok: false, error: 'RESERVATION_EXPIRED' }
      const resolved = resolveWalletActor(store, input.actorUserId, input.actorType)
      if (!resolved.ok) return resolved
      const actor = resolved.actor
      if (!canInitiateAccountWalletUsage(store, actor, input.customerAccountId)) {
        return { ok: false, error: 'UNAUTHORIZED_SPEND' }
      }
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
      const balance = computeWalletBalance(store, wallet, at)
      if (input.amount > balance.availableBalance) return { ok: false, error: 'INSUFFICIENT_CREDITS' }
      const reservation: CreditReservationRecord = {
        id: nextId('res'),
        walletId: wallet.id,
        originAccountId: input.customerAccountId,
        managedSiteId: input.managedSiteId ?? null,
        channel: input.channel ?? 'SMS',
        usagePurpose: input.usagePurpose ?? null,
        rateVersion: input.rateVersion ?? null,
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
      const at = new Date()
      const amountCheck = validateCreditAmount(input.amount)
      if (!amountCheck.ok) return { ok: false, error: 'INVALID_AMOUNT' }
      const resolved = resolveWalletActor(store, input.actorUserId, input.actorType)
      if (!resolved.ok) return resolved
      const existingLedger = store.ledger.find((entry) => entry.idempotencyKey === input.idempotencyKey)
      if (existingLedger) return { ok: true, value: existingLedger }
      const reservation = store.reservations.find((item) => item.id === input.reservationId)
      if (!reservation) return { ok: false, error: 'RESERVATION_NOT_FOUND' }
      const wallet = walletForReservation(store, reservation)
      if (!wallet) return { ok: false, error: 'WALLET_NOT_FOUND' }
      const actor = resolved.actor
      if (!canPerformPrivilegedWalletOperation(store, store.roles, actor, wallet.billingGroupId)) {
        return { ok: false, error: 'UNAUTHORIZED_SETTLE' }
      }
      if (!reservationAcceptsNewSettlement(reservation, at)) {
        if (reservation.expiresAt <= at && OPEN_HOLD_STATUSES.includes(reservation.status)) {
          return { ok: false, error: 'RESERVATION_EXPIRED' }
        }
        return { ok: false, error: 'RESERVATION_NOT_HELD' }
      }
      const remaining = reservation.amount - reservation.settledAmount
      if (input.amount > remaining) return { ok: false, error: 'INSUFFICIENT_CREDITS' }
      reservation.settledAmount += input.amount
      reservation.status = reservation.settledAmount >= reservation.amount ? 'SETTLED' : 'PARTIALLY_SETTLED'
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
      const wallet = walletForReservation(store, reservation)
      if (!wallet) return { ok: false, error: 'WALLET_NOT_FOUND' }
      const resolved = resolveWalletActor(store, input.actorUserId, input.actorType)
      if (!resolved.ok) return resolved
      const actor = resolved.actor
      if (!canPerformPrivilegedWalletOperation(store, store.roles, actor, wallet.billingGroupId)) {
        return { ok: false, error: 'UNAUTHORIZED_SETTLE' }
      }
      if (reservation.status === 'RELEASED') return { ok: true, value: reservation }
      if (reservation.status === 'SETTLED' || reservation.status === 'EXPIRED') {
        return { ok: false, error: 'RESERVATION_NOT_HELD' }
      }
      const unused = reservation.amount - reservation.settledAmount
      reservation.status = reservation.settledAmount > 0 && unused === 0 ? 'SETTLED' : 'RELEASED'
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
      const amountCheck = validateCreditAmount(input.amount)
      if (!amountCheck.ok) return { ok: false, error: 'INVALID_AMOUNT' }
      const existing = store.ledger.find((entry) => entry.idempotencyKey === input.idempotencyKey)
      if (existing) return { ok: true, value: existing }
      const wallet = store.wallets.get(input.walletId)
      if (!wallet || wallet.status !== 'ACTIVE') return { ok: false, error: 'WALLET_NOT_FOUND' }
      const resolved = resolveWalletActor(store, input.actorUserId, input.actorType)
      if (!resolved.ok) return resolved
      const actor = resolved.actor
      if (!canPerformPrivilegedWalletOperation(store, store.roles, actor, wallet.billingGroupId)) {
        return { ok: false, error: 'UNAUTHORIZED_SETTLE' }
      }
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
  actorUserId: string,
  actorType: WalletActor['actorType'] = 'USER',
): WalletResult<WalletLedgerEntryRecord> {
  const amountCheck = validateCreditAmount(amount)
  if (!amountCheck.ok) return { ok: false, error: 'INVALID_AMOUNT' }
  const wallet = findWallet(store, billingGroupId)
  if (!wallet) return { ok: false, error: 'WALLET_NOT_FOUND' }
  const resolved = resolveWalletActor(store, actorUserId, actorType)
  if (!resolved.ok) return resolved
  if (!canPerformPrivilegedWalletOperation(store, store.roles, resolved.actor, billingGroupId)) {
    return { ok: false, error: 'UNAUTHORIZED_SETTLE' }
  }
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
    actorUserId,
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

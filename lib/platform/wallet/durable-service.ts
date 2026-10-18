import type { Prisma, PrismaClient } from '@prisma/client'
import { isEffectiveFundingMembership, type FundingMembership } from '@/lib/platform/billing-authz'
import {
  computeWalletBalanceFromSlices,
  reservationAcceptsNewSettlement,
  reservationOpenHoldAmount,
  OPEN_HOLD_STATUSES,
} from '@/lib/platform/wallet/balance'
import { assertWalletMutationAuthorized } from '@/lib/platform/wallet/durable-authz'
import {
  buildReservationRequestFingerprint,
  reservationFingerprintMatches,
} from '@/lib/platform/wallet/reservation-fingerprint'
import {
  buildProviderEventFingerprint,
  isBillableProviderNormalizedStatus,
} from '@/lib/platform/wallet/provider-reconciliation'
import { walletDurableOperationDenial } from '@/lib/platform/wallet/execution-gates'
import {
  validateProviderReceiptLedgerScope,
  validateRefundLedgerIdempotencyReplay,
  validateSettleLedgerIdempotencyReplay,
} from '@/lib/platform/wallet/ledger-idempotency'
import type {
  DurableRefundCreditsInput,
  DurableReleaseCreditsInput,
  DurableReserveCreditsInput,
  DurableSettleCreditsInput,
} from '@/lib/platform/wallet/durable-contracts'
import {
  evaluateSpendingPolicy,
  getPolicyPeriodStarts,
  sumOpenHoldsForReservations,
  sumSettledCredits,
} from '@/lib/platform/wallet/spending-policy'
import type { CreditReservationRecord, WalletBalance, WalletLedgerEntryRecord, WalletResult } from '@/lib/platform/wallet/types'
import { validateCreditAmount } from '@/lib/platform/wallet/validation'
import { WALLET_RESERVATION_MAX_RETRIES } from '@/config/wallet-backend'

type Tx = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>

function mapReservation(row: {
  id: string
  walletId: string
  originAccountId: string
  managedSiteId: string | null
  channel: string | null
  usagePurpose: string | null
  rateVersion: string | null
  requestFingerprint: string | null
  amount: number
  settledAmount: number
  status: CreditReservationRecord['status']
  expiresAt: Date
  correlationId: string
  campaignId: string | null
  idempotencyKey: string
}): CreditReservationRecord {
  return {
    id: row.id,
    walletId: row.walletId,
    originAccountId: row.originAccountId,
    managedSiteId: row.managedSiteId,
    channel: row.channel,
    usagePurpose: row.usagePurpose,
    rateVersion: row.rateVersion,
    requestFingerprint: row.requestFingerprint,
    amount: row.amount,
    settledAmount: row.settledAmount,
    status: row.status,
    expiresAt: row.expiresAt,
    correlationId: row.correlationId,
    campaignId: row.campaignId,
    idempotencyKey: row.idempotencyKey,
  }
}

function mapLedger(row: {
  id: string
  walletId: string
  customerAccountId: string | null
  managedSiteId: string | null
  campaignId: string | null
  type: WalletLedgerEntryRecord['type']
  deltaCredits: number
  priceVersion: string
  reservationId: string | null
  providerRef: string | null
  originalLedgerEntryId: string | null
  refundReason: string | null
  idempotencyKey: string
  effectiveAt: Date
  actorUserId: string | null
}): WalletLedgerEntryRecord {
  return {
    id: row.id,
    walletId: row.walletId,
    customerAccountId: row.customerAccountId,
    managedSiteId: row.managedSiteId,
    campaignId: row.campaignId,
    type: row.type,
    deltaCredits: row.deltaCredits,
    priceVersion: row.priceVersion,
    reservationId: row.reservationId,
    providerRef: row.providerRef,
    originalLedgerEntryId: row.originalLedgerEntryId,
    refundReason: row.refundReason,
    idempotencyKey: row.idempotencyKey,
    effectiveAt: row.effectiveAt,
    actorUserId: row.actorUserId,
  }
}

async function lockWalletRow(tx: Tx, walletId: string): Promise<void> {
  await tx.$queryRaw`SELECT "id" FROM "CreditWallet" WHERE "id" = ${walletId} FOR UPDATE`
}

async function loadBalance(tx: Tx, walletId: string, billingGroupId: string, at: Date): Promise<WalletBalance> {
  const ledger = await tx.walletLedgerEntry.findMany({ where: { walletId }, select: { deltaCredits: true } })
  const reservations = await tx.creditReservation.findMany({
    where: { walletId, status: { in: OPEN_HOLD_STATUSES } },
    select: { amount: true, settledAmount: true, status: true, expiresAt: true },
  })
  return computeWalletBalanceFromSlices({
    walletId,
    billingGroupId,
    ledger,
    reservations,
    at,
  })
}

async function assertFundingMembership(
  tx: Tx,
  billingGroupId: string,
  customerAccountId: string,
  at: Date,
): Promise<boolean> {
  const rows = await tx.billingGroupMembership.findMany({
    where: { billingGroupId, customerAccountId },
  })
  const funding: FundingMembership[] = rows.map((item) => ({
    billingGroupId: item.billingGroupId,
    customerAccountId: item.customerAccountId,
    status: item.status,
    validFrom: item.validFrom,
    validTo: item.validTo,
    walletUseAllowed: item.walletUseAllowed,
  }))
  return funding.some(
    (item) =>
      item.customerAccountId === customerAccountId &&
      item.billingGroupId === billingGroupId &&
      isEffectiveFundingMembership(item, at),
  )
}

export async function getGroupWallet(
  prisma: PrismaClient,
  billingGroupId: string,
  creditType = 'MESSAGING',
) {
  return prisma.creditWallet.findUnique({
    where: { billingGroupId_creditType: { billingGroupId, creditType } },
  })
}

export async function getWalletBalance(prisma: PrismaClient, walletId: string, at = new Date()): Promise<WalletBalance | null> {
  const wallet = await prisma.creditWallet.findUnique({ where: { id: walletId } })
  if (!wallet) return null
  const ledger = await prisma.walletLedgerEntry.findMany({ where: { walletId }, select: { deltaCredits: true } })
  const reservations = await prisma.creditReservation.findMany({
    where: { walletId, status: { in: OPEN_HOLD_STATUSES } },
    select: { amount: true, settledAmount: true, status: true, expiresAt: true },
  })
  return computeWalletBalanceFromSlices({
    walletId: wallet.id,
    billingGroupId: wallet.billingGroupId,
    ledger,
    reservations,
    at,
  })
}

export async function getAccountWalletUsage(prisma: PrismaClient, walletId: string, customerAccountId: string): Promise<number> {
  const entries = await prisma.walletLedgerEntry.findMany({
    where: { walletId, customerAccountId, type: 'SETTLE' },
    select: { deltaCredits: true },
  })
  return entries.reduce((sum, entry) => sum + Math.abs(entry.deltaCredits), 0)
}

export async function getSiteWalletUsage(
  prisma: PrismaClient,
  walletId: string,
  managedSiteId: string,
): Promise<number> {
  const entries = await prisma.walletLedgerEntry.findMany({
    where: { walletId, managedSiteId, type: 'SETTLE' },
    select: { deltaCredits: true },
  })
  return entries.reduce((sum, entry) => sum + Math.abs(entry.deltaCredits), 0)
}

export async function listWalletLedger(
  prisma: PrismaClient,
  walletId: string,
  query?: { take?: number; skip?: number; from?: Date; to?: Date },
) {
  const where: Prisma.WalletLedgerEntryWhereInput = { walletId }
  if (query?.from || query?.to) {
    where.createdAt = {}
    if (query.from) where.createdAt.gte = query.from
    if (query.to) where.createdAt.lte = query.to
  }
  return prisma.walletLedgerEntry.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: query?.take,
    skip: query?.skip,
  })
}

export async function listWalletReservations(
  prisma: PrismaClient,
  walletId: string,
  query?: { status?: CreditReservationRecord['status'][]; take?: number },
) {
  return prisma.creditReservation.findMany({
    where: {
      walletId,
      ...(query?.status ? { status: { in: query.status } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: query?.take,
  })
}

export async function getReservation(prisma: PrismaClient, reservationId: string) {
  return prisma.creditReservation.findUnique({ where: { id: reservationId } })
}

function isSerializationError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const msg = error.message.toLowerCase()
  return msg.includes('could not serialize') || msg.includes('deadlock') || msg.includes('p2034')
}

function isPrismaUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === 'P2002'
}

async function loadPolicyUsageContext(
  tx: Tx,
  input: {
    walletId: string
    billingGroupId: string
    customerAccountId: string
    managedSiteId?: string | null
    at: Date
    policyTimezone: string
  },
) {
  const periods = getPolicyPeriodStarts(input.at, input.policyTimezone)
  if (!periods.ok) return periods

  const accountLedger = await tx.walletLedgerEntry.findMany({
    where: { walletId: input.walletId, customerAccountId: input.customerAccountId, type: 'SETTLE' },
    select: { deltaCredits: true, effectiveAt: true },
  })
  const siteLedger = input.managedSiteId
    ? await tx.walletLedgerEntry.findMany({
        where: { walletId: input.walletId, managedSiteId: input.managedSiteId, type: 'SETTLE' },
        select: { deltaCredits: true, effectiveAt: true },
      })
    : []
  const groupLedger = await tx.walletLedgerEntry.findMany({
    where: { walletId: input.walletId, type: 'SETTLE' },
    select: { deltaCredits: true, effectiveAt: true },
  })

  const accountReservations = await tx.creditReservation.findMany({
    where: { walletId: input.walletId, originAccountId: input.customerAccountId, status: { in: OPEN_HOLD_STATUSES } },
    select: {
      amount: true,
      settledAmount: true,
      status: true,
      expiresAt: true,
      createdAt: true,
    },
  })
  const siteReservations = input.managedSiteId
    ? await tx.creditReservation.findMany({
        where: { walletId: input.walletId, managedSiteId: input.managedSiteId, status: { in: OPEN_HOLD_STATUSES } },
        select: {
          amount: true,
          settledAmount: true,
          status: true,
          expiresAt: true,
          createdAt: true,
        },
      })
    : []
  const groupReservations = await tx.creditReservation.findMany({
    where: { walletId: input.walletId, status: { in: OPEN_HOLD_STATUSES } },
    select: {
      amount: true,
      settledAmount: true,
      status: true,
      expiresAt: true,
      createdAt: true,
    },
  })

  return {
    ok: true as const,
    context: {
      at: input.at,
      hasManagedSiteScope: Boolean(input.managedSiteId),
      accountDailySettled: sumSettledCredits(accountLedger, periods.dayStartUtc),
      accountDailyOpenHolds: sumOpenHoldsForReservations(accountReservations, input.at, periods.dayStartUtc),
      accountMonthlySettled: sumSettledCredits(accountLedger, periods.monthStartUtc),
      accountMonthlyOpenHolds: sumOpenHoldsForReservations(accountReservations, input.at, periods.monthStartUtc),
      siteDailySettled: sumSettledCredits(siteLedger, periods.dayStartUtc),
      siteDailyOpenHolds: sumOpenHoldsForReservations(siteReservations, input.at, periods.dayStartUtc),
      groupSettledInMonth: sumSettledCredits(groupLedger, periods.monthStartUtc),
      groupOpenHolds: sumOpenHoldsForReservations(groupReservations, input.at),
    },
  }
}

function validateReservationIdempotencyReplay(
  existing: Parameters<typeof mapReservation>[0],
  input: DurableReserveCreditsInput,
  expectedFingerprint: string,
): WalletResult<CreditReservationRecord> {
  if (existing.originAccountId !== input.customerAccountId) {
    return { ok: false, error: 'IDEMPOTENCY_CONFLICT' }
  }
  if (!reservationFingerprintMatches(existing.requestFingerprint, expectedFingerprint)) {
    return { ok: false, error: 'IDEMPOTENCY_CONFLICT' }
  }
  return { ok: true, value: mapReservation(existing) }
}

export async function reserveCredits(
  prisma: PrismaClient,
  input: DurableReserveCreditsInput,
): Promise<WalletResult<CreditReservationRecord>> {
  const reserveDenial = walletDurableOperationDenial('RESERVE')
  if (reserveDenial) return { ok: false, error: reserveDenial }

  const at = input.at ?? new Date()
  const amountCheck = validateCreditAmount(input.amount)
  if (!amountCheck.ok) return { ok: false, error: 'INVALID_AMOUNT' }
  if (input.expiresAt <= at) return { ok: false, error: 'RESERVATION_EXPIRED' }

  for (let attempt = 0; attempt < WALLET_RESERVATION_MAX_RETRIES; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const auth = await assertWalletMutationAuthorized(tx, {
          principal: input.principal,
          operation: 'RESERVE',
          billingGroupId: input.billingGroupId,
          customerAccountId: input.customerAccountId,
          at,
        })
        if (!auth.ok) return auth

        const wallet = await tx.creditWallet.findUnique({
          where: { billingGroupId_creditType: { billingGroupId: input.billingGroupId, creditType: 'MESSAGING' } },
        })
        if (!wallet) return { ok: false, error: 'WALLET_NOT_FOUND' }
        if (wallet.status !== 'ACTIVE') {
          return { ok: false, error: wallet.status === 'FROZEN' ? 'WALLET_FROZEN' : 'WALLET_INACTIVE' }
        }

        const requestFingerprint = buildReservationRequestFingerprint({
          billingGroupId: input.billingGroupId,
          walletId: wallet.id,
          customerAccountId: input.customerAccountId,
          managedSiteId: input.managedSiteId,
          channel: input.channel,
          usagePurpose: input.usagePurpose,
          amount: input.amount,
          rateVersion: input.rateVersion,
          correlationId: input.correlationId,
          campaignId: input.campaignId,
          expiresAt: input.expiresAt,
        })

        const existing = await tx.creditReservation.findUnique({ where: { idempotencyKey: input.idempotencyKey } })
        if (existing) {
          return validateReservationIdempotencyReplay(existing, input, requestFingerprint)
        }

        const funded = await assertFundingMembership(tx, input.billingGroupId, input.customerAccountId, at)
        if (!funded) return { ok: false, error: 'ACCOUNT_NOT_FUNDED' }

        if (input.managedSiteId) {
          const site = await tx.managedSite.findFirst({
            where: { id: input.managedSiteId, customerAccountId: input.customerAccountId },
          })
          if (!site) return { ok: false, error: 'UNAUTHORIZED_SPEND' }
        }

        await lockWalletRow(tx, wallet.id)
        const balance = await loadBalance(tx, wallet.id, wallet.billingGroupId, at)
        if (input.amount > balance.availableBalance) return { ok: false, error: 'INSUFFICIENT_CREDITS' }

        const policy = await tx.siteSpendingPolicy.findUnique({
          where: {
            billingGroupId_customerAccountId: {
              billingGroupId: input.billingGroupId,
              customerAccountId: input.customerAccountId,
            },
          },
        })
        const policyTimezone = policy?.policyTimezone ?? 'UTC'
        const usage = await loadPolicyUsageContext(tx, {
          walletId: wallet.id,
          billingGroupId: input.billingGroupId,
          customerAccountId: input.customerAccountId,
          managedSiteId: input.managedSiteId,
          at,
          policyTimezone,
        })
        if (!usage.ok) return { ok: false, error: usage.error }

        const policyDecision = evaluateSpendingPolicy({
          policy: policy
            ? {
                dailyLimit: policy.dailyLimit,
                monthlyLimit: policy.monthlyLimit,
                managedSiteDailyLimit: policy.managedSiteDailyLimit,
                maxCampaignCredits: policy.maxCampaignCredits,
                groupHardCap: policy.groupHardCap,
                allowedChannels: policy.allowedChannels,
                policyTimezone: policy.policyTimezone,
              }
            : null,
          channel: input.channel,
          requestedCredits: input.amount,
          context: usage.context,
        })
        if (!policyDecision.ok) return { ok: false, error: policyDecision.error }

        try {
          const created = await tx.creditReservation.create({
            data: {
              walletId: wallet.id,
              originAccountId: input.customerAccountId,
              managedSiteId: input.managedSiteId,
              channel: input.channel,
              usagePurpose: input.usagePurpose,
              rateVersion: input.rateVersion,
              requestFingerprint,
              amount: input.amount,
              settledAmount: 0,
              status: 'HELD',
              expiresAt: input.expiresAt,
              correlationId: input.correlationId,
              campaignId: input.campaignId,
              idempotencyKey: input.idempotencyKey,
            },
          })

          await tx.messageUsage.create({
            data: {
              billingGroupId: input.billingGroupId,
              customerAccountId: input.customerAccountId,
              managedSiteId: input.managedSiteId,
              walletId: wallet.id,
              reservationId: created.id,
              channel: input.channel ?? 'SMS',
              units: input.amount,
              credits: input.amount,
              status: 'RESERVED',
              idempotencyKey: `usage_${input.idempotencyKey}`,
            },
          })

          return { ok: true, value: mapReservation(created) }
        } catch (error) {
          if (isPrismaUniqueViolation(error)) throw error
          throw error
        }
      })
    } catch (error) {
      if (isPrismaUniqueViolation(error)) {
        const raced = await prisma.creditReservation.findUnique({ where: { idempotencyKey: input.idempotencyKey } })
        if (raced) {
          const wallet = await prisma.creditWallet.findUnique({
            where: { billingGroupId_creditType: { billingGroupId: input.billingGroupId, creditType: 'MESSAGING' } },
          })
          const requestFingerprint = buildReservationRequestFingerprint({
            billingGroupId: input.billingGroupId,
            walletId: wallet?.id ?? raced.walletId,
            customerAccountId: input.customerAccountId,
            managedSiteId: input.managedSiteId,
            channel: input.channel,
            usagePurpose: input.usagePurpose,
            amount: input.amount,
            rateVersion: input.rateVersion,
            correlationId: input.correlationId,
            campaignId: input.campaignId,
            expiresAt: input.expiresAt,
          })
          return validateReservationIdempotencyReplay(raced, input, requestFingerprint)
        }
      }
      if (isSerializationError(error) && attempt + 1 < WALLET_RESERVATION_MAX_RETRIES) continue
      throw error
    }
  }
  return { ok: false, error: 'INSUFFICIENT_CREDITS' }
}

async function settleReservationInTx(
  tx: Tx,
  input: DurableSettleCreditsInput,
  at: Date,
  actorUserId: string,
): Promise<WalletResult<WalletLedgerEntryRecord>> {
  const reservation = await tx.creditReservation.findUnique({ where: { id: input.reservationId } })
  if (!reservation) return { ok: false, error: 'RESERVATION_NOT_FOUND' }

  const existingLedger = await tx.walletLedgerEntry.findUnique({ where: { idempotencyKey: input.idempotencyKey } })
  if (existingLedger) {
    return validateSettleLedgerIdempotencyReplay(existingLedger, input, reservation, mapLedger)
  }

  const wallet = await tx.creditWallet.findUnique({ where: { id: reservation.walletId } })
  if (!wallet) return { ok: false, error: 'WALLET_NOT_FOUND' }
  if (wallet.status !== 'ACTIVE') return { ok: false, error: 'WALLET_INACTIVE' }

  await lockWalletRow(tx, wallet.id)

  if (!reservationAcceptsNewSettlement(reservation, at)) {
    if (reservation.expiresAt <= at && OPEN_HOLD_STATUSES.includes(reservation.status)) {
      return { ok: false, error: 'RESERVATION_EXPIRED' }
    }
    return { ok: false, error: 'RESERVATION_NOT_HELD' }
  }
  const remaining = reservation.amount - reservation.settledAmount
  if (input.amount > remaining) return { ok: false, error: 'INSUFFICIENT_CREDITS' }

  const nextSettled = reservation.settledAmount + input.amount
  const nextStatus = nextSettled >= reservation.amount ? 'SETTLED' : 'PARTIALLY_SETTLED'

  const updated = await tx.creditReservation.updateMany({
    where: {
      id: reservation.id,
      settledAmount: reservation.settledAmount,
      status: reservation.status,
    },
    data: {
      settledAmount: nextSettled,
      status: nextStatus,
    },
  })
  if (updated.count !== 1) {
    throw new Error('RESERVATION_CAS_CONFLICT')
  }

  let entry
  try {
    entry = await tx.walletLedgerEntry.create({
      data: {
        walletId: reservation.walletId,
        customerAccountId: reservation.originAccountId,
        managedSiteId: input.managedSiteId ?? reservation.managedSiteId,
        campaignId: input.campaignId ?? reservation.campaignId,
        type: 'SETTLE',
        deltaCredits: -input.amount,
        priceVersion: reservation.rateVersion ?? 'wallet09-v1',
        reservationId: reservation.id,
        providerRef: input.providerRef,
        idempotencyKey: input.idempotencyKey,
        actorUserId,
      },
    })
  } catch (error) {
    if (isPrismaUniqueViolation(error)) throw error
    throw error
  }

  await tx.creditWallet.update({
    where: { id: wallet.id },
    data: { ledgerSequence: { increment: 1 } },
  })

  await tx.messageUsage.updateMany({
    where: { reservationId: reservation.id },
    data: { status: nextStatus === 'SETTLED' ? 'SETTLED' : 'RESERVED', credits: nextSettled },
  })

  return { ok: true, value: mapLedger(entry) }
}

export async function settleReservation(
  prisma: PrismaClient,
  input: DurableSettleCreditsInput,
): Promise<WalletResult<WalletLedgerEntryRecord>> {
  const settleDenial = walletDurableOperationDenial('SETTLE')
  if (settleDenial) return { ok: false, error: settleDenial }

  const at = new Date()
  const amountCheck = validateCreditAmount(input.amount)
  if (!amountCheck.ok) return { ok: false, error: 'INVALID_AMOUNT' }

  try {
    return await prisma.$transaction(async (tx) => {
      const reservation = await tx.creditReservation.findUnique({ where: { id: input.reservationId } })
      if (!reservation) return { ok: false, error: 'RESERVATION_NOT_FOUND' }
      const wallet = await tx.creditWallet.findUnique({ where: { id: reservation.walletId } })
      if (!wallet) return { ok: false, error: 'WALLET_NOT_FOUND' }
      const auth = await assertWalletMutationAuthorized(tx, {
        principal: input.principal,
        operation: 'SETTLE',
        billingGroupId: wallet.billingGroupId,
        at,
      })
      if (!auth.ok) return auth
      return settleReservationInTx(tx, input, at, auth.actorUserId)
    })
  } catch (error) {
    if (isPrismaUniqueViolation(error)) {
      const reservation = await prisma.creditReservation.findUnique({ where: { id: input.reservationId } })
      if (!reservation) return { ok: false, error: 'RESERVATION_NOT_FOUND' }
      const existing = await prisma.walletLedgerEntry.findUnique({ where: { idempotencyKey: input.idempotencyKey } })
      if (existing) {
        return validateSettleLedgerIdempotencyReplay(existing, input, reservation, mapLedger)
      }
    }
    throw error
  }
}

export async function releaseReservation(
  prisma: PrismaClient,
  input: DurableReleaseCreditsInput,
): Promise<WalletResult<CreditReservationRecord>> {
  const at = new Date()
  return prisma.$transaction(async (tx) => {
    const reservation = await tx.creditReservation.findUnique({ where: { id: input.reservationId } })
    if (!reservation) return { ok: false, error: 'RESERVATION_NOT_FOUND' }
    const wallet = await tx.creditWallet.findUnique({ where: { id: reservation.walletId } })
    if (!wallet) return { ok: false, error: 'WALLET_NOT_FOUND' }
    const auth = await assertWalletMutationAuthorized(tx, {
      principal: input.principal,
      operation: 'RELEASE',
      billingGroupId: wallet.billingGroupId,
      at,
    })
    if (!auth.ok) return auth
    await lockWalletRow(tx, wallet.id)

    if (reservation.status === 'RELEASED') return { ok: true, value: mapReservation(reservation) }
    if (reservation.status === 'SETTLED' || reservation.status === 'EXPIRED') {
      return { ok: false, error: 'RESERVATION_NOT_HELD' }
    }

    const unused = reservation.amount - reservation.settledAmount
    const nextStatus =
      reservation.settledAmount > 0 && unused === 0 ? 'SETTLED' : unused > 0 ? 'RELEASED' : 'SETTLED'

    const updated = await tx.creditReservation.updateMany({
      where: { id: reservation.id, status: reservation.status, settledAmount: reservation.settledAmount },
      data: { status: nextStatus },
    })
    if (updated.count !== 1) throw new Error('RESERVATION_CAS_CONFLICT')

    if (unused > 0 && nextStatus === 'RELEASED') {
      const existing = await tx.walletLedgerEntry.findUnique({ where: { idempotencyKey: input.idempotencyKey } })
      if (!existing) {
        await tx.walletLedgerEntry.create({
          data: {
            walletId: reservation.walletId,
            customerAccountId: reservation.originAccountId,
            type: 'RELEASE',
            deltaCredits: 0,
            priceVersion: reservation.rateVersion ?? 'wallet09-v1',
            reservationId: reservation.id,
            idempotencyKey: input.idempotencyKey,
            actorUserId: auth.actorUserId,
          },
        })
      }
    }

    if (nextStatus === 'RELEASED') {
      await tx.messageUsage.updateMany({
        where: { reservationId: reservation.id },
        data: { status: 'RELEASED' },
      })
    }

    const fresh = await tx.creditReservation.findUniqueOrThrow({ where: { id: reservation.id } })
    return { ok: true, value: mapReservation(fresh) }
  })
}

export async function expireReservation(
  prisma: PrismaClient,
  reservationId: string,
  principal: import('@/lib/platform/wallet/mutation-principal').WalletMutationPrincipal,
  at = new Date(),
): Promise<WalletResult<CreditReservationRecord>> {
  return prisma.$transaction(async (tx) => {
    const reservation = await tx.creditReservation.findUnique({ where: { id: reservationId } })
    if (!reservation) return { ok: false, error: 'RESERVATION_NOT_FOUND' }
    const wallet = await tx.creditWallet.findUnique({ where: { id: reservation.walletId } })
    if (!wallet) return { ok: false, error: 'WALLET_NOT_FOUND' }
    const auth = await assertWalletMutationAuthorized(tx, {
      principal,
      operation: 'EXPIRE',
      billingGroupId: wallet.billingGroupId,
      at,
    })
    if (!auth.ok) return auth
    if (!OPEN_HOLD_STATUSES.includes(reservation.status)) {
      return { ok: true, value: mapReservation(reservation) }
    }
    if (reservation.expiresAt > at) return { ok: true, value: mapReservation(reservation) }
    await lockWalletRow(tx, reservation.walletId)
    await tx.creditReservation.update({
      where: { id: reservation.id },
      data: { status: 'EXPIRED' },
    })
    await tx.messageUsage.updateMany({
      where: { reservationId: reservation.id },
      data: { status: 'RELEASED' },
    })
    const fresh = await tx.creditReservation.findUniqueOrThrow({ where: { id: reservation.id } })
    return { ok: true, value: mapReservation(fresh) }
  })
}

export async function refundCredits(
  prisma: PrismaClient,
  input: DurableRefundCreditsInput,
): Promise<WalletResult<WalletLedgerEntryRecord>> {
  const refundDenial = walletDurableOperationDenial('REFUND')
  if (refundDenial) return { ok: false, error: refundDenial }

  const amountCheck = validateCreditAmount(input.amount)
  if (!amountCheck.ok) return { ok: false, error: 'INVALID_AMOUNT' }

  try {
    return await prisma.$transaction(async (tx) => {
    const wallet = await tx.creditWallet.findUnique({ where: { id: input.walletId } })
    if (!wallet || wallet.status !== 'ACTIVE') return { ok: false, error: 'WALLET_NOT_FOUND' }

    const auth = await assertWalletMutationAuthorized(tx, {
      principal: input.principal,
      operation: 'REFUND',
      billingGroupId: wallet.billingGroupId,
      at: new Date(),
    })
    if (!auth.ok) return auth

    const original = await tx.walletLedgerEntry.findUnique({ where: { id: input.originalLedgerId } })
    if (!original || original.type !== 'SETTLE' || original.walletId !== wallet.id) {
      return { ok: false, error: 'INVALID_AMOUNT' }
    }

    const existing = await tx.walletLedgerEntry.findUnique({ where: { idempotencyKey: input.idempotencyKey } })
    if (existing) {
      return validateRefundLedgerIdempotencyReplay(existing, input, original, mapLedger)
    }

    await lockWalletRow(tx, wallet.id)

    const priorRefunds = await tx.walletLedgerEntry.aggregate({
      where: { originalLedgerEntryId: input.originalLedgerId, type: 'REFUND' },
      _sum: { deltaCredits: true },
    })
    const alreadyRefunded = priorRefunds._sum.deltaCredits ?? 0
    const eligible = Math.abs(original.deltaCredits) - alreadyRefunded
    if (input.amount > eligible) return { ok: false, error: 'INVALID_AMOUNT' }

    let entry
    try {
      entry = await tx.walletLedgerEntry.create({
        data: {
          walletId: wallet.id,
          customerAccountId: original.customerAccountId,
          managedSiteId: original.managedSiteId,
          type: 'REFUND',
          deltaCredits: input.amount,
          priceVersion: input.priceVersion ?? original.priceVersion,
          originalLedgerEntryId: input.originalLedgerId,
          refundReason: input.refundReason ?? 'wallet09-compensating-entry',
          reservationId: original.reservationId,
          idempotencyKey: input.idempotencyKey,
          actorUserId: auth.actorUserId,
        },
      })
    } catch (error) {
      if (isPrismaUniqueViolation(error)) throw error
      throw error
    }
    await tx.creditWallet.update({
      where: { id: wallet.id },
      data: { ledgerSequence: { increment: 1 } },
    })
    return { ok: true, value: mapLedger(entry) }
  })
  } catch (error) {
    if (isPrismaUniqueViolation(error)) {
      const original = await prisma.walletLedgerEntry.findUnique({ where: { id: input.originalLedgerId } })
      if (!original || original.type !== 'SETTLE') return { ok: false, error: 'INVALID_AMOUNT' }
      const existing = await prisma.walletLedgerEntry.findUnique({ where: { idempotencyKey: input.idempotencyKey } })
      if (existing) {
        return validateRefundLedgerIdempotencyReplay(existing, input, original, mapLedger)
      }
    }
    throw error
  }
}

export async function reconcileProviderSettlementEvent(
  prisma: PrismaClient,
  input: {
    principal: import('@/lib/platform/wallet/mutation-principal').WalletMutationPrincipal
    providerKey: string
    externalEventId: string
    payloadHash: string
    normalizedStatus: string
    reservationId: string
    settleAmount: number
    providerRef: string
    idempotencyKey: string
    eventFingerprint: string
    managedSiteId?: string
  },
): Promise<WalletResult<WalletLedgerEntryRecord>> {
  const reconcileDenial = walletDurableOperationDenial('RECONCILE')
  if (reconcileDenial) return { ok: false, error: reconcileDenial }
  if (!isBillableProviderNormalizedStatus(input.normalizedStatus)) {
    return { ok: false, error: 'UNAUTHORIZED_SETTLE' }
  }
  const expectedFingerprint = buildProviderEventFingerprint({
    providerKey: input.providerKey,
    externalEventId: input.externalEventId,
    payloadHash: input.payloadHash,
    reservationId: input.reservationId,
    settleAmount: input.settleAmount,
  })
  if (input.eventFingerprint !== expectedFingerprint) {
    return { ok: false, error: 'UNAUTHORIZED_SETTLE' }
  }

  const at = new Date()

  const replayProviderReceipt = async (): Promise<WalletResult<WalletLedgerEntryRecord> | null> => {
    const receipt = await prisma.walletProviderEventReceipt.findUnique({
      where: { providerKey_externalEventId: { providerKey: input.providerKey, externalEventId: input.externalEventId } },
    })
    if (!receipt?.ledgerEntryId) return null
    const reservation = await prisma.creditReservation.findUnique({ where: { id: input.reservationId } })
    if (!reservation) return { ok: false, error: 'RESERVATION_NOT_FOUND' }
    const ledger = await prisma.walletLedgerEntry.findUnique({ where: { id: receipt.ledgerEntryId as string } })
    const scoped = validateProviderReceiptLedgerScope({
      receiptWalletId: receipt.walletId as string | null,
      receiptReservationId: receipt.reservationId as string | null,
      reservationId: input.reservationId,
      reservationWalletId: reservation.walletId,
      ledger: ledger,
      settleAmount: input.settleAmount,
    })
    if (!scoped) return { ok: false, error: 'IDEMPOTENCY_CONFLICT' }
    if (ledger) return { ok: true, value: mapLedger(ledger) }
    return null
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const receipt = await tx.walletProviderEventReceipt.findUnique({
        where: { providerKey_externalEventId: { providerKey: input.providerKey, externalEventId: input.externalEventId } },
      })
      if (receipt?.ledgerEntryId) {
        const reservation = await tx.creditReservation.findUnique({ where: { id: input.reservationId } })
        if (!reservation) return { ok: false, error: 'RESERVATION_NOT_FOUND' }
        const ledger = await tx.walletLedgerEntry.findUnique({ where: { id: receipt.ledgerEntryId as string } })
        const scoped = validateProviderReceiptLedgerScope({
          receiptWalletId: receipt.walletId as string | null,
          receiptReservationId: receipt.reservationId as string | null,
          reservationId: input.reservationId,
          reservationWalletId: reservation.walletId,
          ledger,
          settleAmount: input.settleAmount,
        })
        if (!scoped) return { ok: false, error: 'IDEMPOTENCY_CONFLICT' }
        if (ledger) return { ok: true, value: mapLedger(ledger) }
      }

      const reservation = await tx.creditReservation.findUnique({ where: { id: input.reservationId } })
      if (!reservation) return { ok: false, error: 'RESERVATION_NOT_FOUND' }
      const wallet = await tx.creditWallet.findUnique({ where: { id: reservation.walletId } })
      if (!wallet) return { ok: false, error: 'WALLET_NOT_FOUND' }

      const auth = await assertWalletMutationAuthorized(tx, {
        principal: input.principal,
        operation: 'RECONCILE',
        billingGroupId: wallet.billingGroupId,
        at,
      })
      if (!auth.ok) return auth

      if (input.settleAmount > reservation.amount - reservation.settledAmount) {
        return { ok: false, error: 'INSUFFICIENT_CREDITS' }
      }

      const settleResult = await settleReservationInTx(
        tx,
        {
          principal: input.principal,
          reservationId: input.reservationId,
          amount: input.settleAmount,
          providerRef: input.providerRef,
          idempotencyKey: input.idempotencyKey,
          managedSiteId: input.managedSiteId ?? reservation.managedSiteId ?? undefined,
        },
        at,
        auth.actorUserId,
      )
      if (!settleResult.ok) return settleResult

      await tx.walletProviderEventReceipt.create({
        data: {
          providerKey: input.providerKey,
          externalEventId: input.externalEventId,
          walletId: reservation.walletId,
          reservationId: reservation.id,
          ledgerEntryId: settleResult.value.id,
          payloadHash: input.payloadHash,
          normalizedStatus: input.normalizedStatus,
        },
      })
      return settleResult
    })
  } catch (error) {
    if (isPrismaUniqueViolation(error)) {
      const replay = await replayProviderReceipt()
      if (replay) return replay
    }
    throw error
  }
}

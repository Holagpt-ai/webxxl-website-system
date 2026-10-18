import type { Prisma, PrismaClient } from '@prisma/client'
import { isEffectiveFundingMembership, type FundingMembership } from '@/lib/platform/billing-authz'
import {
  computeWalletBalanceFromSlices,
  reservationAcceptsNewSettlement,
  reservationOpenHoldAmount,
  OPEN_HOLD_STATUSES,
} from '@/lib/platform/wallet/balance'
import { resolveDurableWalletActor } from '@/lib/platform/wallet/durable-actor'
import type {
  ReleaseCreditsInput,
  RefundCreditsInput,
  ReserveCreditsInput,
  SettleCreditsInput,
} from '@/lib/platform/wallet/contracts'
import { buildReservationRequestFingerprint } from '@/lib/platform/wallet/reservation-fingerprint'
import { evaluateSpendingPolicy, sumOpenHoldsForReservations } from '@/lib/platform/wallet/spending-policy'
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

export async function reserveCredits(
  prisma: PrismaClient,
  input: ReserveCreditsInput,
): Promise<WalletResult<CreditReservationRecord>> {
  const at = input.at ?? new Date()
  const amountCheck = validateCreditAmount(input.amount)
  if (!amountCheck.ok) return { ok: false, error: 'INVALID_AMOUNT' }
  if (input.expiresAt <= at) return { ok: false, error: 'RESERVATION_EXPIRED' }
  const resolved = resolveDurableWalletActor(input.actorUserId, input.actorType)
  if (!resolved.ok) return resolved

  for (let attempt = 0; attempt < WALLET_RESERVATION_MAX_RETRIES; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const existing = await tx.creditReservation.findUnique({ where: { idempotencyKey: input.idempotencyKey } })
        if (existing) {
          if (existing.originAccountId !== input.customerAccountId || existing.amount !== input.amount) {
            return { ok: false, error: 'IDEMPOTENCY_CONFLICT' }
          }
          return { ok: true, value: mapReservation(existing) }
        }

        const wallet = await tx.creditWallet.findUnique({
          where: { billingGroupId_creditType: { billingGroupId: input.billingGroupId, creditType: 'MESSAGING' } },
        })
        if (!wallet) return { ok: false, error: 'WALLET_NOT_FOUND' }
        if (wallet.status !== 'ACTIVE') {
          return { ok: false, error: wallet.status === 'FROZEN' ? 'WALLET_FROZEN' : 'WALLET_INACTIVE' }
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

        const openReservations = await tx.creditReservation.findMany({
          where: {
            walletId: wallet.id,
            originAccountId: input.customerAccountId,
            status: { in: OPEN_HOLD_STATUSES },
          },
        })
        const accountOpenHolds = sumOpenHoldsForReservations(
          openReservations.map((item) => ({
            amount: item.amount,
            settledAmount: item.settledAmount,
            status: item.status,
            expiresAt: item.expiresAt,
          })),
          at,
        )
        const accountSettled = await tx.walletLedgerEntry.aggregate({
          where: { walletId: wallet.id, customerAccountId: input.customerAccountId, type: 'SETTLE' },
          _sum: { deltaCredits: true },
        })
        const accountSettledCredits = Math.abs(accountSettled._sum.deltaCredits ?? 0)

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
          context: {
            at,
            accountSettledCredits,
            accountOpenHolds,
          },
        })
        if (!policyDecision.ok) return { ok: false, error: policyDecision.error }

        const requestFingerprint = buildReservationRequestFingerprint({
          walletId: wallet.id,
          customerAccountId: input.customerAccountId,
          managedSiteId: input.managedSiteId,
          channel: input.channel,
          usagePurpose: input.usagePurpose,
          amount: input.amount,
          rateVersion: input.rateVersion,
          correlationId: input.correlationId,
        })

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
      })
    } catch (error) {
      if (isSerializationError(error) && attempt + 1 < WALLET_RESERVATION_MAX_RETRIES) continue
      throw error
    }
  }
  return { ok: false, error: 'INSUFFICIENT_CREDITS' }
}

async function settleReservationInTx(
  tx: Tx,
  input: SettleCreditsInput,
  at: Date,
): Promise<WalletResult<WalletLedgerEntryRecord>> {
  const existingLedger = await tx.walletLedgerEntry.findUnique({ where: { idempotencyKey: input.idempotencyKey } })
  if (existingLedger) return { ok: true, value: mapLedger(existingLedger) }

  const reservation = await tx.creditReservation.findUnique({ where: { id: input.reservationId } })
  if (!reservation) return { ok: false, error: 'RESERVATION_NOT_FOUND' }
  const wallet = await tx.creditWallet.findUnique({ where: { id: reservation.walletId } })
  if (!wallet) return { ok: false, error: 'WALLET_NOT_FOUND' }

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

  const entry = await tx.walletLedgerEntry.create({
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
      actorUserId: input.actorUserId,
    },
  })

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
  input: SettleCreditsInput,
): Promise<WalletResult<WalletLedgerEntryRecord>> {
  const at = new Date()
  const amountCheck = validateCreditAmount(input.amount)
  if (!amountCheck.ok) return { ok: false, error: 'INVALID_AMOUNT' }
  const resolved = resolveDurableWalletActor(input.actorUserId, input.actorType)
  if (!resolved.ok) return resolved

  return prisma.$transaction(async (tx) => settleReservationInTx(tx, input, at))
}

export async function releaseReservation(
  prisma: PrismaClient,
  input: ReleaseCreditsInput,
): Promise<WalletResult<CreditReservationRecord>> {
  const resolved = resolveDurableWalletActor(input.actorUserId, input.actorType)
  if (!resolved.ok) return resolved

  return prisma.$transaction(async (tx) => {
    const reservation = await tx.creditReservation.findUnique({ where: { id: input.reservationId } })
    if (!reservation) return { ok: false, error: 'RESERVATION_NOT_FOUND' }
    const wallet = await tx.creditWallet.findUnique({ where: { id: reservation.walletId } })
    if (!wallet) return { ok: false, error: 'WALLET_NOT_FOUND' }
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
            actorUserId: input.actorUserId,
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
  at = new Date(),
): Promise<WalletResult<CreditReservationRecord>> {
  return prisma.$transaction(async (tx) => {
    const reservation = await tx.creditReservation.findUnique({ where: { id: reservationId } })
    if (!reservation) return { ok: false, error: 'RESERVATION_NOT_FOUND' }
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
  input: RefundCreditsInput,
): Promise<WalletResult<WalletLedgerEntryRecord>> {
  const amountCheck = validateCreditAmount(input.amount)
  if (!amountCheck.ok) return { ok: false, error: 'INVALID_AMOUNT' }
  const resolved = resolveDurableWalletActor(input.actorUserId, input.actorType)
  if (!resolved.ok) return resolved

  return prisma.$transaction(async (tx) => {
    const existing = await tx.walletLedgerEntry.findUnique({ where: { idempotencyKey: input.idempotencyKey } })
    if (existing) return { ok: true, value: mapLedger(existing) }

    const wallet = await tx.creditWallet.findUnique({ where: { id: input.walletId } })
    if (!wallet || wallet.status !== 'ACTIVE') return { ok: false, error: 'WALLET_NOT_FOUND' }

    if (input.originalLedgerId) {
      const original = await tx.walletLedgerEntry.findUnique({ where: { id: input.originalLedgerId } })
      if (!original || original.type !== 'SETTLE') return { ok: false, error: 'INVALID_AMOUNT' }
      const priorRefunds = await tx.walletLedgerEntry.aggregate({
        where: { originalLedgerEntryId: input.originalLedgerId, type: 'REFUND' },
        _sum: { deltaCredits: true },
      })
      const alreadyRefunded = priorRefunds._sum.deltaCredits ?? 0
      const eligible = Math.abs(original.deltaCredits) - alreadyRefunded
      if (input.amount > eligible) return { ok: false, error: 'INVALID_AMOUNT' }
    }

    await lockWalletRow(tx, wallet.id)
    const entry = await tx.walletLedgerEntry.create({
      data: {
        walletId: wallet.id,
        customerAccountId: input.customerAccountId,
        type: 'REFUND',
        deltaCredits: input.amount,
        priceVersion: input.priceVersion ?? 'wallet09-v1',
        originalLedgerEntryId: input.originalLedgerId,
        refundReason: 'wallet09-compensating-entry',
        reservationId: input.originalLedgerId ?? null,
        idempotencyKey: input.idempotencyKey,
        actorUserId: input.actorUserId,
      },
    })
    await tx.creditWallet.update({
      where: { id: wallet.id },
      data: { ledgerSequence: { increment: 1 } },
    })
    return { ok: true, value: mapLedger(entry) }
  })
}

export async function reconcileProviderSettlementEvent(
  prisma: PrismaClient,
  input: {
    providerKey: string
    externalEventId: string
    payloadHash: string
    normalizedStatus: string
    reservationId: string
    settleAmount: number
    providerRef: string
    idempotencyKey: string
    actorUserId: string
    managedSiteId?: string
  },
): Promise<WalletResult<WalletLedgerEntryRecord>> {
  return prisma.$transaction(async (tx) => {
    const receipt = await tx.walletProviderEventReceipt.findUnique({
      where: { providerKey_externalEventId: { providerKey: input.providerKey, externalEventId: input.externalEventId } },
    })
    if (receipt?.ledgerEntryId) {
      const ledger = await tx.walletLedgerEntry.findUnique({ where: { id: receipt.ledgerEntryId } })
      if (ledger) return { ok: true, value: mapLedger(ledger) }
    }

    const reservation = await tx.creditReservation.findUnique({ where: { id: input.reservationId } })
    if (!reservation) return { ok: false, error: 'RESERVATION_NOT_FOUND' }

    const settleResult = await settleReservationInTx(
      tx,
      {
        actorUserId: input.actorUserId,
        actorType: 'SERVICE',
        reservationId: input.reservationId,
        amount: input.settleAmount,
        providerRef: input.providerRef,
        idempotencyKey: input.idempotencyKey,
        managedSiteId: input.managedSiteId,
      },
      new Date(),
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
}

/** Test/synthetic funding only — production mint requires WalletFundingEvidence (COMMERCE-11). */
export async function seedSyntheticWalletTopUp(
  prisma: PrismaClient,
  input: {
    billingGroupId: string
    amount: number
    idempotencyKey: string
    actorUserId: string
    evidenceRef?: string
  },
): Promise<WalletResult<WalletLedgerEntryRecord>> {
  const amountCheck = validateCreditAmount(input.amount)
  if (!amountCheck.ok) return { ok: false, error: 'INVALID_AMOUNT' }
  if (!input.evidenceRef?.startsWith('synthetic-test:')) {
    return { ok: false, error: 'UNAUTHORIZED_SETTLE' }
  }

  return prisma.$transaction(async (tx) => {
    const wallet = await tx.creditWallet.findUnique({
      where: { billingGroupId_creditType: { billingGroupId: input.billingGroupId, creditType: 'MESSAGING' } },
    })
    if (!wallet) return { ok: false, error: 'WALLET_NOT_FOUND' }
    const existing = await tx.walletLedgerEntry.findUnique({ where: { idempotencyKey: input.idempotencyKey } })
    if (existing) return { ok: true, value: mapLedger(existing) }
    await lockWalletRow(tx, wallet.id)
    const entry = await tx.walletLedgerEntry.create({
      data: {
        walletId: wallet.id,
        type: 'TOP_UP',
        deltaCredits: input.amount,
        priceVersion: 'wallet09-synthetic-v1',
        providerRef: input.evidenceRef,
        idempotencyKey: input.idempotencyKey,
        actorUserId: input.actorUserId,
      },
    })
    await tx.creditWallet.update({ where: { id: wallet.id }, data: { ledgerSequence: { increment: 1 } } })
    return { ok: true, value: mapLedger(entry) }
  })
}

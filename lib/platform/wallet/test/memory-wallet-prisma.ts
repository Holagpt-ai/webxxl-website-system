import type { PrismaClient } from '@prisma/client'
import { isSyntheticServiceActorUserId } from '@/lib/platform/wallet/ledger-actor-attribution'

type WalletRow = {
  id: string
  billingGroupId: string
  creditType: string
  unit: string
  status: 'ACTIVE' | 'FROZEN' | 'CLOSED'
  ledgerSequence: number
}

type LedgerRow = {
  id: string
  walletId: string
  customerAccountId: string | null
  managedSiteId: string | null
  campaignId: string | null
  type: string
  deltaCredits: number
  priceVersion: string
  reservationId: string | null
  providerRef: string | null
  originalLedgerEntryId: string | null
  refundReason: string | null
  idempotencyKey: string
  effectiveAt: Date
  createdAt: Date
  actorUserId: string | null
  actorServiceId: string | null
  orderId: string | null
}

type ReservationRow = {
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
  status: string
  expiresAt: Date
  correlationId: string
  campaignId: string | null
  idempotencyKey: string
  createdAt: Date
  updatedAt: Date
}

const locks = new Map<string, Promise<void>>()

async function withWalletLock<T>(walletId: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(walletId) ?? Promise.resolve()
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  locks.set(
    walletId,
    prev.then(() => gate),
  )
  await prev
  try {
    return await fn()
  } finally {
    release()
  }
}

let seq = 0
function cid(prefix: string) {
  seq += 1
  return `${prefix}_${seq}`
}

export function createMemoryWalletPrisma(seed: {
  billingGroupId: string
  walletId: string
  memberships: Array<{
    billingGroupId: string
    customerAccountId: string
    status: string
    validFrom: Date
    validTo: Date | null
    walletUseAllowed: boolean
  }>
  sites?: Array<{ id: string; customerAccountId: string }>
  policies?: Array<{
    billingGroupId: string
    customerAccountId: string
    maxCampaignCredits: number | null
    dailyLimit: number | null
    monthlyLimit: number | null
    allowedChannels: string[] | null
  }>
  /** When set, ledger actorUserId must reference one of these ids (simulates User FK). */
  knownUserIds?: string[]
}) {
  const wallets: WalletRow[] = [
    {
      id: seed.walletId,
      billingGroupId: seed.billingGroupId,
      creditType: 'MESSAGING',
      unit: 'CREDITS',
      status: 'ACTIVE',
      ledgerSequence: 0,
    },
  ]
  const ledger: LedgerRow[] = []
  const reservations: ReservationRow[] = []
  const messageUsage: Array<Record<string, unknown>> = []
  const providerReceipts: Array<Record<string, unknown>> = []
  const topUpQuotes: Array<Record<string, unknown>> = []
  const fundingEvidence: Array<Record<string, unknown>> = []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client: any = {
    creditWallet: {
      findUnique: async ({ where }: { where: { id?: string; billingGroupId_creditType?: { billingGroupId: string; creditType: string } } }) => {
        if (where.id) return wallets.find((w) => w.id === where.id) ?? null
        if (where.billingGroupId_creditType) {
          return (
            wallets.find(
              (w) =>
                w.billingGroupId === where.billingGroupId_creditType!.billingGroupId &&
                w.creditType === where.billingGroupId_creditType!.creditType,
            ) ?? null
          )
        }
        return null
      },
      update: async ({ where, data }: { where: { id: string }; data: { ledgerSequence?: { increment: number } } }) => {
        const wallet = wallets.find((w) => w.id === where.id)
        if (!wallet) throw new Error('wallet missing')
        if (data.ledgerSequence?.increment) wallet.ledgerSequence += data.ledgerSequence.increment
        return wallet
      },
    },
    walletLedgerEntry: {
      findMany: async ({ where }: { where: { walletId?: string; customerAccountId?: string; type?: string } }) =>
        ledger.filter((entry) => {
          if (where.walletId && entry.walletId !== where.walletId) return false
          if (where.customerAccountId && entry.customerAccountId !== where.customerAccountId) return false
          if (where.type && entry.type !== where.type) return false
          return true
        }),
      findUnique: async ({ where }: { where: { idempotencyKey?: string; id?: string } }) => {
        if (where.id) return ledger.find((e) => e.id === where.id) ?? null
        if (where.idempotencyKey) return ledger.find((e) => e.idempotencyKey === where.idempotencyKey) ?? null
        return null
      },
      aggregate: async ({
        where,
      }: {
        where: {
          walletId?: string
          customerAccountId?: string
          type?: string
          originalLedgerEntryId?: string
        }
        _sum: { deltaCredits: boolean }
      }) => {
        const rows = ledger.filter((entry) => {
          if (where.walletId && entry.walletId !== where.walletId) return false
          if (where.customerAccountId && entry.customerAccountId !== where.customerAccountId) return false
          if (where.type && entry.type !== where.type) return false
          if (
            where.originalLedgerEntryId != null &&
            entry.originalLedgerEntryId !== where.originalLedgerEntryId
          ) {
            return false
          }
          return true
        })
        return { _sum: { deltaCredits: rows.reduce((s, r) => s + r.deltaCredits, 0) } }
      },
      create: async ({ data }: { data: Partial<LedgerRow> & { walletId: string; type: string; deltaCredits: number; priceVersion: string; idempotencyKey: string; actorServiceId?: string | null } }) => {
        if (isSyntheticServiceActorUserId(data.actorUserId ?? null)) {
          const err = new Error('Foreign key violation: actorUserId') as Error & { code: string }
          err.code = 'P2003'
          throw err
        }
        if (data.actorUserId && seed.knownUserIds && !seed.knownUserIds.includes(data.actorUserId)) {
          const err = new Error('Foreign key violation: actorUserId') as Error & { code: string }
          err.code = 'P2003'
          throw err
        }
        const row: LedgerRow = {
          id: cid('led'),
          walletId: data.walletId,
          customerAccountId: data.customerAccountId ?? null,
          managedSiteId: data.managedSiteId ?? null,
          campaignId: data.campaignId ?? null,
          type: data.type,
          deltaCredits: data.deltaCredits,
          priceVersion: data.priceVersion,
          reservationId: data.reservationId ?? null,
          providerRef: data.providerRef ?? null,
          originalLedgerEntryId: data.originalLedgerEntryId ?? null,
          refundReason: data.refundReason ?? null,
          idempotencyKey: data.idempotencyKey,
          effectiveAt: data.effectiveAt ?? new Date(),
          createdAt: new Date(),
          actorUserId: data.actorUserId ?? null,
          actorServiceId: data.actorServiceId ?? null,
          orderId: data.orderId ?? null,
        }
        ledger.push(row)
        return row
      },
    },
    creditReservation: {
      findUnique: async ({ where }: { where: { id?: string; idempotencyKey?: string } }) => {
        if (where.id) return reservations.find((r) => r.id === where.id) ?? null
        if (where.idempotencyKey) return reservations.find((r) => r.idempotencyKey === where.idempotencyKey) ?? null
        return null
      },
      findMany: async ({
        where,
      }: {
        where: { walletId?: string; originAccountId?: string; status?: { in: string[] } }
      }) =>
        reservations.filter((r) => {
          if (where.walletId && r.walletId !== where.walletId) return false
          if (where.originAccountId && r.originAccountId !== where.originAccountId) return false
          if (where.status?.in && !where.status.in.includes(r.status)) return false
          return true
        }),
      create: async ({ data }: { data: Partial<ReservationRow> & { walletId: string; originAccountId: string; amount: number; idempotencyKey: string } }) => {
        const row: ReservationRow = {
          id: cid('res'),
          walletId: data.walletId,
          originAccountId: data.originAccountId,
          managedSiteId: data.managedSiteId ?? null,
          channel: data.channel ?? null,
          usagePurpose: data.usagePurpose ?? null,
          rateVersion: data.rateVersion ?? null,
          requestFingerprint: data.requestFingerprint ?? null,
          amount: data.amount,
          settledAmount: data.settledAmount ?? 0,
          status: data.status ?? 'HELD',
          expiresAt: data.expiresAt ?? new Date(Date.now() + 3600_000),
          correlationId: data.correlationId ?? cid('corr'),
          campaignId: data.campaignId ?? null,
          idempotencyKey: data.idempotencyKey,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
        reservations.push(row)
        return row
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: {
          id: string
          settledAmount?: number
          status?: string | { in: string[] }
          expiresAt?: { lte: Date }
        }
        data: { settledAmount?: number; status?: string }
      }) => {
        const row = reservations.find((r) => {
          if (r.id !== where.id) return false
          if (where.settledAmount != null && r.settledAmount !== where.settledAmount) return false
          if (typeof where.status === 'string' && r.status !== where.status) return false
          if (where.status && typeof where.status === 'object' && !where.status.in.includes(r.status)) {
            return false
          }
          if (where.expiresAt?.lte && r.expiresAt > where.expiresAt.lte) return false
          return true
        })
        if (!row) return { count: 0 }
        if (data.settledAmount != null) row.settledAmount = data.settledAmount
        if (data.status != null) row.status = data.status
        row.updatedAt = new Date()
        return { count: 1 }
      },
      update: async ({ where, data }: { where: { id: string }; data: { status: string } }) => {
        const row = reservations.find((r) => r.id === where.id)
        if (!row) throw new Error('missing')
        row.status = data.status
        return row
      },
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) => {
        const row = reservations.find((r) => r.id === where.id)
        if (!row) throw new Error('missing')
        return row
      },
    },
    messageUsage: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        messageUsage.push(data)
        return data
      },
      updateMany: async ({ where, data }: { where: { reservationId: string }; data: Record<string, unknown> }) => {
        for (const row of messageUsage) {
          if (row.reservationId === where.reservationId) Object.assign(row, data)
        }
        return { count: 1 }
      },
    },
    billingGroup: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        where.id === seed.billingGroupId ? { id: seed.billingGroupId, status: 'ACTIVE' } : null,
    },
    customerMembership: {
      findFirst: async () => null,
    },
    billingGroupRole: {
      findUnique: async () => null,
    },
    billingGroupMembership: {
      findMany: async ({ where }: { where: { billingGroupId?: string; customerAccountId?: string } }) =>
        seed.memberships.filter((m) => {
          if (where.billingGroupId && m.billingGroupId !== where.billingGroupId) return false
          if (where.customerAccountId && m.customerAccountId !== where.customerAccountId) return false
          return true
        }),
    },
    managedSite: {
      findFirst: async ({ where }: { where: { id: string; customerAccountId: string } }) =>
        seed.sites?.find((s) => s.id === where.id && s.customerAccountId === where.customerAccountId) ?? null,
    },
    siteSpendingPolicy: {
      findUnique: async ({
        where,
      }: {
        where: { billingGroupId_customerAccountId: { billingGroupId: string; customerAccountId: string } }
      }) => {
        const policy = seed.policies?.find(
          (p) =>
            p.billingGroupId === where.billingGroupId_customerAccountId.billingGroupId &&
            p.customerAccountId === where.billingGroupId_customerAccountId.customerAccountId,
        )
        if (!policy) return null
        return {
          ...policy,
          managedSiteDailyLimit: null,
          groupHardCap: null,
          policyTimezone: 'UTC',
          allowedChannels: policy.allowedChannels,
        }
      },
    },
    walletProviderEventReceipt: {
      findUnique: async ({ where }: { where: { providerKey_externalEventId: { providerKey: string; externalEventId: string } } }) =>
        providerReceipts.find(
          (r) =>
            r.providerKey === where.providerKey_externalEventId.providerKey &&
            r.externalEventId === where.providerKey_externalEventId.externalEventId,
        ) ?? null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const dup = providerReceipts.find(
          (r) => r.providerKey === data.providerKey && r.externalEventId === data.externalEventId,
        )
        if (dup) {
          const err = new Error('Unique constraint') as Error & { code: string }
          err.code = 'P2002'
          throw err
        }
        const row = { id: cid('rcpt'), ...data }
        providerReceipts.push(row)
        return row
      },
    },
    walletTopUpQuote: {
      findUnique: async ({ where }: { where: { idempotencyKey: string } }) =>
        topUpQuotes.find((q) => q.idempotencyKey === where.idempotencyKey) ?? null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: cid('tuq'), ...data }
        topUpQuotes.push(row)
        return row
      },
    },
    walletFundingEvidence: {
      findUnique: async ({ where }: { where: { externalPaymentRef?: string; id?: string } }) => {
        if (where.id) return fundingEvidence.find((row) => row.id === where.id) ?? null
        if (where.externalPaymentRef) {
          return fundingEvidence.find((row) => row.externalPaymentRef === where.externalPaymentRef) ?? null
        }
        return null
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        if (fundingEvidence.some((row) => row.externalPaymentRef === data.externalPaymentRef)) {
          const err = new Error('Unique constraint') as Error & { code: string }
          err.code = 'P2002'
          throw err
        }
        const row = {
          ledgerEntryId: null,
          verifiedAt: null,
          commerceOrderId: null,
          commercePaymentId: null,
          priceVersion: null,
          ...data,
          id: cid('fund'),
        }
        fundingEvidence.push(row)
        return row
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = fundingEvidence.find((item) => item.id === where.id)
        if (!row) throw new Error('funding evidence missing')
        Object.assign(row, data)
        return row
      },
    },
    $queryRaw: async () => [],
    $transaction: async <T>(fn: (tx: typeof client) => Promise<T>) => {
      const walletId = seed.walletId
      return withWalletLock(walletId, () => fn(client))
    },
  }

  return { prisma: client as unknown as PrismaClient, ledger, reservations, wallets }
}

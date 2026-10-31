import type { PrismaClient } from '@prisma/client'
import { OPEN_HOLD_STATUSES } from '@/lib/platform/wallet/balance'
import { listWalletReservations } from '@/lib/platform/wallet/durable-service'

export type WalletReservationReviewItem = {
  reservationId: string
  walletId: string
  customerAccountId: string | null
  status: string
  amount: number
  reason: 'OPEN_HOLD' | 'EXPIRED_HELD' | 'PARTIALLY_SETTLED_OPEN'
}

export async function listWalletReservationReviewItems(
  prisma: PrismaClient,
  walletId: string,
  limit = 50,
  at = new Date(),
): Promise<WalletReservationReviewItem[]> {
  const rows = await listWalletReservations(prisma, walletId, { take: limit })
  const items: WalletReservationReviewItem[] = []
  for (const row of rows) {
    if (OPEN_HOLD_STATUSES.includes(row.status)) {
      const expired = row.expiresAt <= at
      items.push({
        reservationId: row.id,
        walletId: row.walletId,
        customerAccountId: row.originAccountId,
        status: row.status,
        amount: row.amount,
        reason: row.status === 'PARTIALLY_SETTLED' ? 'PARTIALLY_SETTLED_OPEN' : expired ? 'EXPIRED_HELD' : 'OPEN_HOLD',
      })
    }
  }
  return items.slice(0, limit)
}

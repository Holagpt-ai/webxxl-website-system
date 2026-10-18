import { NextResponse } from 'next/server'
import { WALLET_LIST_DEFAULT_TAKE, WALLET_LIST_MAX_TAKE } from '@/config/wallet-backend'
import { getGroupWallet, listWalletReservations } from '@/lib/platform/wallet/durable-service'
import { requireBillingGroupWalletAccess } from '@/lib/platform/wallet/route-auth'
import { walletRouteError } from '@/lib/platform/wallet/wallet-api-error'

type Params = { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: Params) {
  try {
    const { id: billingGroupId } = await params
    await requireBillingGroupWalletAccess(billingGroupId, 'wallet.ledger.read')
    const url = new URL(request.url)
    const take = Math.min(
      Math.max(Number(url.searchParams.get('take') ?? WALLET_LIST_DEFAULT_TAKE), 1),
      WALLET_LIST_MAX_TAKE,
    )
    const { prisma } = await import('@/lib/db')
    const wallet = await getGroupWallet(prisma, billingGroupId)
    if (!wallet) return NextResponse.json({ code: 'NOT_FOUND', message: 'Wallet not found' }, { status: 404 })
    const reservations = await listWalletReservations(prisma, wallet.id, { take })
    return NextResponse.json({
      reservations: reservations.map((item) => ({
        id: item.id,
        originAccountId: item.originAccountId,
        amount: item.amount,
        settledAmount: item.settledAmount,
        status: item.status,
        expiresAt: item.expiresAt.toISOString(),
        channel: item.channel,
      })),
    })
  } catch (error) {
    return walletRouteError(error)
  }
}

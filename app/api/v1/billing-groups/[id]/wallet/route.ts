import { NextResponse } from 'next/server'
import { getGroupWallet, getWalletBalance } from '@/lib/platform/wallet/durable-service'
import { toWalletBalanceDto } from '@/lib/platform/wallet/api-dto'
import { prisma } from '@/lib/db'
import { requireBillingGroupWalletAccess } from '@/lib/platform/wallet/route-auth'
import { walletRouteError } from '@/lib/platform/wallet/wallet-api-error'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id: billingGroupId } = await params
    await requireBillingGroupWalletAccess(billingGroupId, 'wallet.balance.read')
    const wallet = await getGroupWallet(prisma, billingGroupId)
    if (!wallet) return NextResponse.json({ code: 'NOT_FOUND', message: 'Wallet not found' }, { status: 404 })
    const balance = await getWalletBalance(prisma, wallet.id)
    if (!balance) return NextResponse.json({ code: 'NOT_FOUND', message: 'Balance unavailable' }, { status: 404 })
    return NextResponse.json({ wallet: toWalletBalanceDto(balance, wallet.creditType) })
  } catch (error) {
    return walletRouteError(error)
  }
}

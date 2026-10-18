import { NextResponse } from 'next/server'
import { isWalletTopUpEnabled } from '@/config/wallet-backend'
import { prisma } from '@/lib/db'
import { prepareWalletTopUpQuote } from '@/lib/platform/wallet/top-up-quote'
import { requireBillingGroupWalletAccess } from '@/lib/platform/wallet/route-auth'
import { WalletApiError, walletRouteError } from '@/lib/platform/wallet/wallet-api-error'

export async function POST(request: Request) {
  try {
    if (!isWalletTopUpEnabled()) {
      throw new WalletApiError(503, 'Wallet top-up preparation disabled', 'WALLET_TOPUP_DISABLED')
    }
    const body = (await request.json()) as {
      billingGroupId?: string
      creditAmount?: number
      fiatMinorUnits?: number
      priceVersion?: string
      providerKey?: string
      idempotencyKey?: string
      expiresAt?: string
    }
    if (!body.billingGroupId || !body.creditAmount || !body.fiatMinorUnits || !body.priceVersion || !body.idempotencyKey) {
      return NextResponse.json(
        { code: 'VALIDATION', message: 'billingGroupId, creditAmount, fiatMinorUnits, priceVersion, idempotencyKey required' },
        { status: 400 },
      )
    }
    const actor = await requireBillingGroupWalletAccess(body.billingGroupId, 'wallet.group.manage')
    const result = await prepareWalletTopUpQuote(prisma, {
      billingGroupId: body.billingGroupId,
      creditAmount: body.creditAmount,
      fiatMinorUnits: body.fiatMinorUnits,
      priceVersion: body.priceVersion,
      providerKey: body.providerKey,
      idempotencyKey: body.idempotencyKey,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : new Date(Date.now() + 30 * 60_000),
      payerUserId: actor.userId,
    })
    if (!result.ok) {
      return NextResponse.json({ code: result.error, message: 'Top-up quote rejected' }, { status: 409 })
    }
    return NextResponse.json(
      {
        quote: result.value,
        paymentConfirmed: false,
        walletCreditsMinted: false,
      },
      { status: 201 },
    )
  } catch (error) {
    return walletRouteError(error)
  }
}

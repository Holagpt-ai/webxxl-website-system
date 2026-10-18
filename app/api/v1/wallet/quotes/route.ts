import { NextResponse } from 'next/server'
import { estimateMessagingCost } from '@/lib/platform/wallet/rate-plan'
import { requireWalletApiActor } from '@/lib/platform/wallet/route-auth'
import { walletRouteError } from '@/lib/platform/wallet/wallet-api-error'

export async function POST(request: Request) {
  try {
    await requireWalletApiActor('wallet.quote.prepare')
    const body = (await request.json()) as {
      channel?: 'SMS' | 'EMAIL'
      providerKey?: string
      body?: string
      purpose?: string
    }
    if (!body.channel || !body.providerKey || !body.body) {
      return NextResponse.json({ code: 'VALIDATION', message: 'channel, providerKey, body required' }, { status: 400 })
    }
    const estimate = estimateMessagingCost({
      channel: body.channel,
      providerKey: body.providerKey,
      body: body.body,
      purpose: body.purpose,
    })
    if (!estimate.ok) {
      return NextResponse.json({ code: estimate.error, message: 'Cost unavailable' }, { status: 422 })
    }
    return NextResponse.json({ quote: estimate.value })
  } catch (error) {
    return walletRouteError(error)
  }
}

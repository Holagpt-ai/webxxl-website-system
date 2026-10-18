import { NextResponse } from 'next/server'
import { listFixtureRateVersions } from '@/lib/platform/wallet/rate-plan'
import { requireWalletApiActor } from '@/lib/platform/wallet/route-auth'
import { walletRouteError } from '@/lib/platform/wallet/wallet-api-error'

export async function GET() {
  try {
    await requireWalletApiActor('wallet.quote.prepare')
    return NextResponse.json({ rates: listFixtureRateVersions() })
  } catch (error) {
    return walletRouteError(error)
  }
}

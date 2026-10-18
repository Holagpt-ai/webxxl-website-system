import { NextResponse } from 'next/server'
import { getAccountWalletUsage, getGroupWallet, getSiteWalletUsage } from '@/lib/platform/wallet/durable-service'
import { prisma } from '@/lib/db'
import { requireBillingGroupWalletAccess } from '@/lib/platform/wallet/route-auth'
import { walletRouteError } from '@/lib/platform/wallet/wallet-api-error'

type Params = { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: Params) {
  try {
    const { id: billingGroupId } = await params
    const actor = await requireBillingGroupWalletAccess(billingGroupId, 'wallet.usage.read')
    const url = new URL(request.url)
    const managedSiteId = url.searchParams.get('managedSiteId')
    const wallet = await getGroupWallet(prisma, billingGroupId)
    if (!wallet) return NextResponse.json({ code: 'NOT_FOUND', message: 'Wallet not found' }, { status: 404 })

    if (actor.scopedAccountId) {
      const settled = await getAccountWalletUsage(prisma, wallet.id, actor.scopedAccountId)
      const siteSettled =
        managedSiteId != null ? await getSiteWalletUsage(prisma, wallet.id, managedSiteId) : undefined
      return NextResponse.json({
        usage: {
          customerAccountId: actor.scopedAccountId,
          settledCredits: settled,
          managedSiteId: managedSiteId ?? undefined,
          siteSettledCredits: siteSettled,
        },
      })
    }

    const memberships = await prisma.billingGroupMembership.findMany({
      where: { billingGroupId, status: 'ACTIVE' },
      select: { customerAccountId: true },
    })
    const byAccount = await Promise.all(
      memberships.map(async (m) => ({
        customerAccountId: m.customerAccountId,
        settledCredits: await getAccountWalletUsage(prisma, wallet.id, m.customerAccountId),
      })),
    )
    return NextResponse.json({ usage: { accounts: byAccount } })
  } catch (error) {
    return walletRouteError(error)
  }
}

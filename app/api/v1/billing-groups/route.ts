import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireWalletApiActor } from '@/lib/platform/wallet/route-auth'
import { walletRouteError } from '@/lib/platform/wallet/wallet-api-error'

export async function GET() {
  try {
    const actor = await requireWalletApiActor('wallet.balance.read')
    const roles = await prisma.billingGroupRole.findMany({ where: { userId: actor.userId } })
    const funded = await prisma.billingGroupMembership.findMany({
      where: { customerAccountId: actor.customerAccountId, status: 'ACTIVE', walletUseAllowed: true },
    })
    const groupIds = [...new Set([...roles.map((r) => r.billingGroupId), ...funded.map((f) => f.billingGroupId)])]
    const groups = await prisma.billingGroup.findMany({
      where: { id: { in: groupIds } },
      select: { id: true, name: true, slug: true, status: true, defaultCurrency: true },
    })
    return NextResponse.json({ billingGroups: groups })
  } catch (error) {
    return walletRouteError(error)
  }
}

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { buildSeoConnectionsAuthorizationContract } from '@/lib/platform/seo/connections-authorization-contract'
import { seoRouteError } from '@/lib/platform/seo/http'
import { requireSeoApiActor } from '@/lib/platform/seo/route-auth'

type Params = { params: Promise<{ siteId: string }> }

export async function GET(_request: Request, { params }: Params) {
  try {
    const actor = await requireSeoApiActor('seo.read')
    const { siteId } = await params
    const connections = await prisma.siteAnalyticsConnection.findMany({
      where: { managedSiteId: siteId, customerAccountId: actor.customerAccountId },
      select: {
        id: true,
        provider: true,
        propertyRef: true,
        propertyKind: true,
        verificationState: true,
        dataState: true,
        lastVerifiedAt: true,
        revokedAt: true,
      },
    })
    const authorization = buildSeoConnectionsAuthorizationContract(siteId, connections)
    return NextResponse.json({ connections, authorization })
  } catch (error) {
    return seoRouteError(error)
  }
}
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSeoApiActor, SeoApiError } from '@/lib/platform/seo/route-auth'

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
    return NextResponse.json({ connections })
  } catch (error) {
    if (error instanceof SeoApiError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.status })
    }
    console.error('seo connections GET failed', error)
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Unable to load SEO connections' }, { status: 500 })
  }
}

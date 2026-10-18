import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { mktRouteError, mktServiceResponse } from '@/lib/platform/marketing/api-response'
import { createMarketingBrandContextVersion } from '@/lib/platform/marketing/brand-context-service'
import { assertManagedSiteInAccount } from '@/lib/platform/marketing/account-isolation'
import { requireMktApiActor } from '@/lib/platform/marketing/route-auth'
import { getManagedSiteForAccount } from '@/lib/managed-sites/queries'

type Params = { params: Promise<{ siteId: string }> }

export async function GET(_request: Request, { params }: Params) {
  try {
    const actor = await requireMktApiActor('marketing.read')
    const { siteId } = await params
    const site = await assertManagedSiteInAccount({
      siteId,
      customerAccountId: actor.customerAccountId,
      loadSite: (id, acct) => getManagedSiteForAccount(id, acct),
    })
    if (!site.ok) return mktServiceResponse(site)
    const versions = await prisma.marketingBrandContextVersion.findMany({
      where: { customerAccountId: actor.customerAccountId, managedSiteId: siteId },
      orderBy: { versionNumber: 'desc' },
      take: 10,
    })
    return NextResponse.json({ versions })
  } catch (error) {
    return mktRouteError(error)
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const actor = await requireMktApiActor('marketing.brand.manage')
    const { siteId } = await params
    const site = await assertManagedSiteInAccount({
      siteId,
      customerAccountId: actor.customerAccountId,
      loadSite: (id, acct) => getManagedSiteForAccount(id, acct),
    })
    if (!site.ok) return mktServiceResponse(site)
    const body = (await request.json()) as {
      businessName?: string
      locale?: 'en' | 'es'
      approvedServices?: string[]
      audience?: string
      brandTone?: string
      approvedClaims?: string[]
    }
    if (!body.businessName) {
      return NextResponse.json({ code: 'VALIDATION', message: 'businessName required' }, { status: 400 })
    }
    const created = await createMarketingBrandContextVersion({
      customerAccountId: actor.customerAccountId,
      managedSiteId: siteId,
      businessName: body.businessName,
      locale: body.locale ?? 'en',
      approvedServices: body.approvedServices,
      audience: body.audience,
      brandTone: body.brandTone,
      approvedClaims: body.approvedClaims,
      userId: actor.userId,
    })
    return mktServiceResponse(created, 201)
  } catch (error) {
    return mktRouteError(error)
  }
}

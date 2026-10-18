import { NextResponse } from 'next/server'
import { seoResultHttpStatus } from '@/lib/platform/seo/seo-api-map'
import { createCompetitorMarket } from '@/lib/platform/seo/market-service'
import { requireSeoApiActor, SeoApiError } from '@/lib/platform/seo/route-auth'

type Params = { params: Promise<{ siteId: string }> }

export async function POST(request: Request, { params }: Params) {
  try {
    const actor = await requireSeoApiActor('seo.market.manage')
    const { siteId } = await params
    const body = (await request.json()) as {
      name?: string
      category?: string
      services?: string[]
      radiusKm?: number
      keywordThemes?: string[]
      candidateCompetitors?: unknown
    }
    if (!body.name || !body.category) {
      return NextResponse.json({ code: 'VALIDATION', message: 'name and category required' }, { status: 400 })
    }
    const created = await createCompetitorMarket({
      customerAccountId: actor.customerAccountId,
      managedSiteId: siteId,
      name: body.name,
      category: body.category,
      services: body.services,
      radiusKm: body.radiusKm,
      keywordThemes: body.keywordThemes,
      candidateCompetitors: body.candidateCompetitors,
    })
    if (!created.ok) {
      return NextResponse.json({ code: created.code, message: created.message }, { status: seoResultHttpStatus(created.code) })
    }
    return NextResponse.json(created.value, { status: 201 })
  } catch (error) {
    if (error instanceof SeoApiError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.status })
    }
    console.error('seo markets POST failed', error)
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Unable to create SEO market' }, { status: 500 })
  }
}

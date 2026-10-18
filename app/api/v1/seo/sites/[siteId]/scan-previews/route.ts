import { NextResponse } from 'next/server'
import { seoResultHttpStatus } from '@/lib/platform/seo/seo-api-map'
import { prepareSeoScanPreview } from '@/lib/platform/seo/scan-preview-service'
import { requireSeoApiActor, SeoApiError } from '@/lib/platform/seo/route-auth'

type Params = { params: Promise<{ siteId: string }> }

export async function POST(request: Request, { params }: Params) {
  try {
    const actor = await requireSeoApiActor('seo.scan.prepare')
    const { siteId } = await params
    const body = (await request.json()) as { idempotencyKey?: string; maxPages?: number; maxDepth?: number }
    if (!body.idempotencyKey) {
      return NextResponse.json({ code: 'VALIDATION', message: 'idempotencyKey required' }, { status: 400 })
    }
    const prepared = await prepareSeoScanPreview({
      customerAccountId: actor.customerAccountId,
      managedSiteId: siteId,
      idempotencyKey: body.idempotencyKey,
      maxPages: body.maxPages,
      maxDepth: body.maxDepth,
    })
    if (!prepared.ok) {
      return NextResponse.json({ code: prepared.code, message: prepared.message }, { status: seoResultHttpStatus(prepared.code) })
    }
    return NextResponse.json(prepared.value, { status: 202 })
  } catch (error) {
    if (error instanceof SeoApiError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.status })
    }
    console.error('seo scan-previews POST failed', error)
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Unable to prepare SEO scan' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { loadGoogleConnectionsForAccount } from '@/lib/platform/google/prisma-load'
import {
  parseGoogleReadinessProviders,
  runBoundedGoogleReadinessOperation,
} from '@/lib/platform/google/readiness-operation'
import { validateGoogleReadinessClientRequestKey } from '@/lib/platform/google/readiness-request-validate'
import { requireSeoApiActor, SeoApiError } from '@/lib/platform/seo/route-auth'
import { requireManagedSiteInAccount } from '@/lib/platform/seo/site-scope'

type Params = { params: Promise<{ siteId: string }> }

export async function POST(request: Request, { params }: Params) {
  try {
    const actor = await requireSeoApiActor('seo.configure')
    const { siteId } = await params
    const site = await requireManagedSiteInAccount({
      siteId,
      customerAccountId: actor.customerAccountId,
    })
    if (!site.ok) {
      return NextResponse.json({ code: site.code, message: site.message }, { status: site.code === 'NOT_FOUND' ? 404 : 400 })
    }

    const headerKey = request.headers.get('Idempotency-Key') ?? request.headers.get('idempotency-key')
    const requestKey = validateGoogleReadinessClientRequestKey(headerKey)
    if (!requestKey.ok) {
      return NextResponse.json({ code: requestKey.code, message: requestKey.message }, { status: 400 })
    }

    let body: unknown = {}
    const raw = await request.text()
    if (raw.trim()) {
      try {
        body = JSON.parse(raw) as unknown
      } catch {
        return NextResponse.json({ code: 'VALIDATION', message: 'Request body must be valid JSON' }, { status: 400 })
      }
    }
    const bodyObj = body && typeof body === 'object' && !Array.isArray(body) ? (body as { providers?: unknown }) : {}
    const parsedProviders = parseGoogleReadinessProviders(bodyObj.providers as never)
    if (!parsedProviders.ok) {
      return NextResponse.json({ code: parsedProviders.code, message: parsedProviders.message }, { status: 400 })
    }

    const connections = await loadGoogleConnectionsForAccount({
      customerAccountId: actor.customerAccountId,
      managedSiteId: siteId,
    })
    let siteCanonicalUrl: string | null = null
    if (site.value.domain) {
      siteCanonicalUrl = site.value.domain.startsWith('http') ? site.value.domain : `https://${site.value.domain}`
    }

    const result = await runBoundedGoogleReadinessOperation({
      customerAccountId: actor.customerAccountId,
      managedSiteId: siteId,
      authorizedHosts: site.value.authorizedHosts,
      siteCanonicalUrl,
      connections,
      providers: parsedProviders.value.providers,
      clientRequestKey: requestKey.value.normalized,
    })
    if (!result.ok) {
      const status = result.code === 'NOT_CONFIGURED' ? 503 : 400
      return NextResponse.json({ code: result.code, message: result.message }, { status })
    }
    return NextResponse.json({ outcomes: result.value.outcomes })
  } catch (error) {
    if (error instanceof SeoApiError) {
      return NextResponse.json({ code: error.code, message: error.message }, { status: error.status })
    }
    if (error instanceof Error && error.message.startsWith('Missing SEO permission:')) {
      return NextResponse.json({ code: 'FORBIDDEN', message: error.message }, { status: 403 })
    }
    console.error('seo google readiness assess POST failed', error)
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Unable to run Google readiness operation' }, { status: 500 })
  }
}

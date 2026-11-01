import { NextResponse } from 'next/server'
import { loadGoogleConnectionsForAccount } from '@/lib/platform/google/prisma-load'
import {
  parseGoogleReadinessProviders,
  runBoundedGoogleReadinessOperation,
} from '@/lib/platform/google/readiness-operation'
import type { GoogleAnalyticsProviderKey } from '@/lib/platform/google/types'
import { requireSeoApiActor, SeoApiError } from '@/lib/platform/seo/route-auth'
import { requireManagedSiteInAccount } from '@/lib/platform/seo/site-scope'

type Params = { params: Promise<{ siteId: string }> }

export async function POST(request: Request, { params }: Params) {
  try {
    const actor = await requireSeoApiActor('seo.read')
    const { siteId } = await params
    const site = await requireManagedSiteInAccount({
      siteId,
      customerAccountId: actor.customerAccountId,
    })
    if (!site.ok) {
      return NextResponse.json({ code: site.code, message: site.message }, { status: site.code === 'NOT_FOUND' ? 404 : 400 })
    }

    const idempotencyKey = request.headers.get('Idempotency-Key') ?? request.headers.get('idempotency-key')
    if (!idempotencyKey?.trim()) {
      return NextResponse.json({ code: 'VALIDATION', message: 'Idempotency-Key header required' }, { status: 400 })
    }

    let bodyProviders: GoogleAnalyticsProviderKey[] | undefined
    try {
      const body = (await request.json().catch(() => ({}))) as { providers?: GoogleAnalyticsProviderKey[] }
      bodyProviders = body.providers
    } catch {
      bodyProviders = undefined
    }
    const parsedProviders = parseGoogleReadinessProviders(bodyProviders)
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
      idempotencyKey: idempotencyKey.trim(),
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
    console.error('seo google readiness assess POST failed', error)
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'Unable to run Google readiness operation' }, { status: 500 })
  }
}

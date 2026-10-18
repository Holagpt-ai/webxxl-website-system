import { isSeoGscApiEnabled, isSeoGoogleOauthEnabled, SEO_GSC_MAX_ROWS } from '@/config/seo-backend'
import { normalizeGscSearchAnalyticsResponse } from '@/lib/platform/seo/gsc-normalize'
import { queryGscSearchAnalytics, type GscHttpTransport } from '@/lib/platform/seo/gsc-http'
import { matchGscPropertyToSite } from '@/lib/platform/seo/property-match'
import type { GscSearchAnalyticsRequest } from '@/lib/platform/seo/gsc-types'
import type { ProviderAuthContext, ProviderResult, SeoSourceProvider } from '@/lib/platform/providers/types'

export type GoogleGscSeoProviderDeps = {
  transport: GscHttpTransport
  resolveAccessTokenRef: (context: ProviderAuthContext) => Promise<string | null>
  resolvePropertyRef: (context: ProviderAuthContext) => Promise<string | null>
  resolveAuthorizedHosts: (context: ProviderAuthContext) => Promise<string[]>
}

export function createGoogleGscSeoProvider(deps: GoogleGscSeoProviderDeps): SeoSourceProvider {
  return {
    kind: 'seo',
    key: 'google-gsc',
    displayName: 'Google Search Console',
    availability: 'CANDIDATE',
    replaceable: true,
    installed: true,
    async readOverview(context: ProviderAuthContext): Promise<ProviderResult<{ status: 'NOT_CONNECTED' | 'READY'; propertyRef?: string }>> {
      if (!isSeoGscApiEnabled() || !isSeoGoogleOauthEnabled()) {
        return { ok: true, value: { status: 'NOT_CONNECTED' } }
      }
      const propertyRef = await deps.resolvePropertyRef(context)
      if (!propertyRef) return { ok: true, value: { status: 'NOT_CONNECTED' } }
      const hosts = await deps.resolveAuthorizedHosts(context)
      const match = matchGscPropertyToSite({ propertyRef, authorizedHosts: hosts })
      if (!match.ok) return { ok: false, code: 'DENIED', message: match.message }
      return { ok: true, value: { status: 'READY', propertyRef } }
    },
    async querySearchAnalytics(
      context: ProviderAuthContext,
      request: GscSearchAnalyticsRequest,
    ): Promise<
      ProviderResult<ReturnType<typeof normalizeGscSearchAnalyticsResponse>> | { ok: false; code: 'UNKNOWN'; message: string }
    > {
      if (!isSeoGscApiEnabled() || !isSeoGoogleOauthEnabled()) {
        return { ok: false, code: 'NOT_CONFIGURED', message: 'GSC API disabled' }
      }
      const propertyRef = await deps.resolvePropertyRef(context)
      if (!propertyRef) return { ok: false, code: 'NOT_CONFIGURED', message: 'No GSC property bound' }
      const tokenRef = await deps.resolveAccessTokenRef(context)
      const body: GscSearchAnalyticsRequest = {
        ...request,
        rowLimit: Math.min(request.rowLimit ?? SEO_GSC_MAX_ROWS, SEO_GSC_MAX_ROWS),
      }
      const queried = await queryGscSearchAnalytics({
        transport: deps.transport,
        propertyRef,
        body,
        accessTokenRef: tokenRef,
      })
      if (!queried.ok) return queried
      return {
        ok: true,
        value: normalizeGscSearchAnalyticsResponse({
          propertyRef,
          request: body,
          response: queried.response,
          observedAt: new Date(),
        }),
      }
    },
  } as SeoSourceProvider & {
    querySearchAnalytics: (
      context: ProviderAuthContext,
      request: GscSearchAnalyticsRequest,
    ) => Promise<ProviderResult<ReturnType<typeof normalizeGscSearchAnalyticsResponse>>>
  }
}

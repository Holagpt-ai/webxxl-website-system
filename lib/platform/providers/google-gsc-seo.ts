import { isSeoGscApiEnabled, isSeoGoogleOauthEnabled, SEO_GSC_MAX_ROWS } from '@/config/seo-backend'
import { authorizeGscSearchAnalyticsQuery, type GscConnectionRecord } from '@/lib/platform/seo/gsc-query-auth'
import { normalizeGscSearchAnalyticsResponse } from '@/lib/platform/seo/gsc-normalize'
import { queryGscSearchAnalytics, type GscHttpTransport } from '@/lib/platform/seo/gsc-http'
import { matchGscPropertyToSite } from '@/lib/platform/seo/property-match'
import type { GscSearchAnalyticsRequest } from '@/lib/platform/seo/gsc-types'
import type { ProviderAuthContext, ProviderResult, SeoSourceProvider } from '@/lib/platform/providers/types'

export type GoogleGscSeoProviderDeps = {
  transport: GscHttpTransport
  resolveConnection: (context: ProviderAuthContext) => Promise<GscConnectionRecord | null>
  resolveAccessTokenRef: (context: ProviderAuthContext) => Promise<string | null>
  resolvePropertyRef: (context: ProviderAuthContext) => Promise<string | null>
  resolveAuthorizedHosts: (context: ProviderAuthContext) => Promise<string[]>
  resolveSiteCanonicalUrl?: (context: ProviderAuthContext) => Promise<string | null>
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
      const connection = await deps.resolveConnection(context)
      const propertyRef = connection?.propertyRef ?? (await deps.resolvePropertyRef(context))
      if (!propertyRef || !connection) return { ok: true, value: { status: 'NOT_CONNECTED' } }
      const hosts = await deps.resolveAuthorizedHosts(context)
      const match = matchGscPropertyToSite({
        propertyRef,
        authorizedHosts: hosts,
        siteCanonicalUrl: deps.resolveSiteCanonicalUrl ? await deps.resolveSiteCanonicalUrl(context) : null,
      })
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
      const connection = await deps.resolveConnection(context)
      const hosts = await deps.resolveAuthorizedHosts(context)
      const canonical = deps.resolveSiteCanonicalUrl ? await deps.resolveSiteCanonicalUrl(context) : null
      const authorized = authorizeGscSearchAnalyticsQuery({
        contextAccountId: context.customerAccountId,
        contextManagedSiteId: context.managedSiteId,
        connection,
        authorizedHosts: hosts,
        siteCanonicalUrl: canonical,
        request,
        requestedPropertyRef: connection?.propertyRef,
      })
      if (!authorized.ok) {
        const code = authorized.code === 'FORBIDDEN' ? 'DENIED' : authorized.code === 'VALIDATION' ? 'UNAVAILABLE' : authorized.code
        return { ok: false, code: code as 'NOT_CONFIGURED' | 'DENIED' | 'UNAVAILABLE', message: authorized.message }
      }
      const tokenRef = await deps.resolveAccessTokenRef(context)
      if (!tokenRef || tokenRef !== authorized.value.secretRef) {
        return { ok: false, code: 'NOT_CONFIGURED', message: 'GSC OAuth secret reference invalid' }
      }
      const body: GscSearchAnalyticsRequest = {
        ...request,
        rowLimit: Math.min(request.rowLimit ?? SEO_GSC_MAX_ROWS, SEO_GSC_MAX_ROWS),
      }
      const queried = await queryGscSearchAnalytics({
        transport: deps.transport,
        propertyRef: authorized.value.propertyRef,
        body,
        accessTokenRef: tokenRef,
      })
      if (!queried.ok) return queried
      return {
        ok: true,
        value: normalizeGscSearchAnalyticsResponse({
          propertyRef: authorized.value.propertyRef,
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

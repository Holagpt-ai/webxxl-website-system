import { isSeoGa4ApiEnabled, isSeoGoogleOauthEnabled } from '@/config/seo-backend'
import { validateGooglePropertyRef } from '@/lib/platform/google/property-ref'
import type { ProviderAuthContext, ProviderResult, SeoSourceOverview, SeoSourceProvider } from '@/lib/platform/providers/types'

export type Ga4ConnectionRecord = {
  customerAccountId: string
  managedSiteId: string
  propertyRef: string
  verificationState: string
  dataState: string
  secretRef: string | null
  revokedAt: Date | null
}

export type GoogleGa4SeoProviderDeps = {
  resolveConnection: (context: ProviderAuthContext) => Promise<Ga4ConnectionRecord | null>
}

export function createGoogleGa4SeoProvider(deps?: Partial<GoogleGa4SeoProviderDeps>): SeoSourceProvider {
  return {
    kind: 'seo',
    key: 'google-ga4',
    displayName: 'Google Analytics 4',
    availability: 'CANDIDATE',
    replaceable: true,
    installed: true,
    async readOverview(context: ProviderAuthContext): Promise<ProviderResult<SeoSourceOverview>> {
      if (!isSeoGa4ApiEnabled() || !isSeoGoogleOauthEnabled()) {
        return { ok: true, value: { status: 'NOT_CONNECTED', provider: 'GA4' } }
      }
      const connection = deps?.resolveConnection ? await deps.resolveConnection(context) : null
      if (!connection || connection.revokedAt || connection.verificationState !== 'VERIFIED') {
        return { ok: true, value: { status: 'NOT_CONNECTED', provider: 'GA4' } }
      }
      const valid = validateGooglePropertyRef('GA4', connection.propertyRef)
      if (!valid.ok) {
        return { ok: false, code: 'UNAVAILABLE', message: valid.message }
      }
      if (connection.customerAccountId !== context.customerAccountId) {
        return { ok: false, code: 'DENIED', message: 'GA4 connection account mismatch' }
      }
      if (context.managedSiteId && connection.managedSiteId !== context.managedSiteId) {
        return { ok: false, code: 'DENIED', message: 'GA4 connection site mismatch' }
      }
      return {
        ok: true,
        value: {
          status: 'PARTIAL',
          provider: 'GA4',
          propertyRef: connection.propertyRef,
        },
      }
    },
  }
}

/** Default SEO-07 stub — live GA4 reporting ingest remains NOT_SUPPORTED until owner activation. */
export const googleGa4SeoProvider = createGoogleGa4SeoProvider()

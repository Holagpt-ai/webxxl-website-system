import { isSeoGbpApiEnabled, isSeoGoogleOauthEnabled } from '@/config/seo-backend'
import { validateGooglePropertyRef } from '@/lib/platform/google/property-ref'
import type { ProviderAuthContext, ProviderResult, SeoSourceOverview, SeoSourceProvider } from '@/lib/platform/providers/types'

export type GbpConnectionRecord = {
  customerAccountId: string
  managedSiteId: string
  propertyRef: string
  verificationState: string
  dataState: string
  secretRef: string | null
  revokedAt: Date | null
}

export type GoogleGbpSeoProviderDeps = {
  resolveConnection: (context: ProviderAuthContext) => Promise<GbpConnectionRecord | null>
}

export function createGoogleGbpSeoProvider(deps?: Partial<GoogleGbpSeoProviderDeps>): SeoSourceProvider {
  return {
    kind: 'seo',
    key: 'google-gbp',
    displayName: 'Google Business Profile Performance',
    availability: 'CANDIDATE',
    replaceable: true,
    installed: true,
    async readOverview(context: ProviderAuthContext): Promise<ProviderResult<SeoSourceOverview>> {
      if (!isSeoGbpApiEnabled() || !isSeoGoogleOauthEnabled()) {
        return { ok: true, value: { status: 'NOT_CONNECTED', provider: 'GBP' } }
      }
      const connection = deps?.resolveConnection ? await deps.resolveConnection(context) : null
      if (!connection || connection.revokedAt || connection.verificationState !== 'VERIFIED') {
        return { ok: true, value: { status: 'NOT_CONNECTED', provider: 'GBP' } }
      }
      const valid = validateGooglePropertyRef('GBP', connection.propertyRef)
      if (!valid.ok) {
        return { ok: false, code: 'UNAVAILABLE', message: valid.message }
      }
      if (connection.customerAccountId !== context.customerAccountId) {
        return { ok: false, code: 'DENIED', message: 'GBP connection account mismatch' }
      }
      if (context.managedSiteId && connection.managedSiteId !== context.managedSiteId) {
        return { ok: false, code: 'DENIED', message: 'GBP connection site mismatch' }
      }
      return {
        ok: true,
        value: {
          status: 'NOT_SUPPORTED',
          provider: 'GBP',
          propertyRef: connection.propertyRef,
        },
      }
    },
  }
}

export const googleGbpSeoProvider = createGoogleGbpSeoProvider()

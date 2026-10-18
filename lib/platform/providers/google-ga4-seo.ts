import { isSeoGa4ApiEnabled, isSeoGoogleOauthEnabled } from '@/config/seo-backend'
import type { ProviderAuthContext, ProviderResult, SeoSourceProvider } from '@/lib/platform/providers/types'

export function createGoogleGa4SeoProvider(): SeoSourceProvider {
  return {
    kind: 'seo',
    key: 'google-ga4',
    displayName: 'Google Analytics 4',
    availability: 'CANDIDATE',
    replaceable: true,
    installed: true,
    async readOverview(_context: ProviderAuthContext): Promise<ProviderResult<import('@/lib/platform/providers/types').SeoSourceOverview>> {
      if (!isSeoGa4ApiEnabled() || !isSeoGoogleOauthEnabled()) {
        return { ok: true, value: { status: 'NOT_CONNECTED', provider: 'GA4' } }
      }
      return { ok: true, value: { status: 'NOT_SUPPORTED', provider: 'GA4' } }
    },
  }
}

import { isSeoGbpApiEnabled, isSeoGoogleOauthEnabled } from '@/config/seo-backend'
import type { ProviderAuthContext, ProviderResult, SeoSourceProvider } from '@/lib/platform/providers/types'

export function createGoogleGbpSeoProvider(): SeoSourceProvider {
  return {
    kind: 'seo',
    key: 'google-gbp',
    displayName: 'Google Business Profile Performance',
    availability: 'CANDIDATE',
    replaceable: true,
    installed: true,
    async readOverview(_context: ProviderAuthContext): Promise<ProviderResult<import('@/lib/platform/providers/types').SeoSourceOverview>> {
      if (!isSeoGbpApiEnabled() || !isSeoGoogleOauthEnabled()) {
        return { ok: true, value: { status: 'NOT_CONNECTED', provider: 'GBP' } }
      }
      return { ok: true, value: { status: 'NOT_SUPPORTED', provider: 'GBP' } }
    },
  }
}

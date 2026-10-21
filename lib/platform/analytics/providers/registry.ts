import {
  isSeoGa4ApiEnabled,
  isSeoGbpApiEnabled,
  isSeoGoogleOauthEnabled,
  isSeoGscApiEnabled,
  isSeoRankProviderEnabled,
} from '@/config/seo-backend'
import type { ProviderAuthContext, ProviderResult } from '@/lib/platform/providers/types'
import type { AnalyticsSourceProvider } from '@/lib/platform/analytics/providers/types'

function disabledState(
  provider: AnalyticsSourceProvider['key'],
  message: string,
): ProviderResult<import('@/lib/platform/analytics/providers/types').AnalyticsProviderConnectionState> {
  return { ok: true, value: { provider, status: 'NOT_CONNECTED', message } }
}

export function listAnalyticsSourceProviders(): AnalyticsSourceProvider[] {
  return [
    {
      key: 'GSC',
      displayName: 'Google Search Console',
      async describeConnection(_context: ProviderAuthContext) {
        if (!isSeoGscApiEnabled() || !isSeoGoogleOauthEnabled()) {
          return disabledState('GSC', 'GSC API or Google OAuth disabled')
        }
        return { ok: true, value: { provider: 'GSC', status: 'PENDING', message: 'Awaiting authorized property selection' } }
      },
    },
    {
      key: 'GA4',
      displayName: 'Google Analytics 4',
      async describeConnection(_context: ProviderAuthContext) {
        if (!isSeoGa4ApiEnabled() || !isSeoGoogleOauthEnabled()) {
          return disabledState('GA4', 'GA4 API or Google OAuth disabled')
        }
        return { ok: true, value: { provider: 'GA4', status: 'PENDING', message: 'Awaiting authorized property selection' } }
      },
    },
    {
      key: 'GBP',
      displayName: 'Google Business Profile Performance',
      async describeConnection(_context: ProviderAuthContext) {
        if (!isSeoGbpApiEnabled() || !isSeoGoogleOauthEnabled()) {
          return disabledState('GBP', 'GBP API or Google OAuth disabled')
        }
        return { ok: true, value: { provider: 'GBP', status: 'NOT_SUPPORTED', message: 'GBP ingestion adapter pending live credentials' } }
      },
    },
    {
      key: 'WEBXXL_EVENTS',
      displayName: 'WebXXL first-party events',
      async describeConnection() {
        return { ok: true, value: { provider: 'WEBXXL_EVENTS', status: 'READY' } }
      },
    },
    {
      key: 'RANK_VENDOR',
      displayName: 'Licensed rank tracking',
      async describeConnection() {
        if (!isSeoRankProviderEnabled()) {
          return disabledState('RANK_VENDOR', 'Rank provider disabled')
        }
        return { ok: true, value: { provider: 'RANK_VENDOR', status: 'NOT_CONNECTED' } }
      },
    },
  ]
}

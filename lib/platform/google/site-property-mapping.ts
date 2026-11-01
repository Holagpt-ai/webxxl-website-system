import { matchGscPropertyToSite } from '@/lib/platform/seo/property-match'
import type { GoogleAnalyticsProviderKey } from '@/lib/platform/google/types'
import type { SeoResult } from '@/lib/platform/seo/types'

export function assessGoogleSitePropertyMapping(input: {
  provider: GoogleAnalyticsProviderKey
  propertyRef: string
  authorizedHosts: string[]
  siteCanonicalUrl?: string | null
}): SeoResult<{ siteMappingOk: boolean; limitations: string[] }> {
  const limitations: string[] = []
  switch (input.provider) {
    case 'GSC': {
      const match = matchGscPropertyToSite({
        propertyRef: input.propertyRef,
        authorizedHosts: input.authorizedHosts,
        siteCanonicalUrl: input.siteCanonicalUrl,
      })
      if (!match.ok) {
        limitations.push(match.message)
        return { ok: true, value: { siteMappingOk: false, limitations } }
      }
      return { ok: true, value: { siteMappingOk: true, limitations } }
    }
    case 'GA4':
      limitations.push(
        'GA4 property-to-site host binding is stored on SiteAnalyticsConnection; live property metadata fetch is not performed in readiness assess.',
      )
      return { ok: true, value: { siteMappingOk: true, limitations } }
    case 'GBP':
      limitations.push(
        'GBP listing-to-site alignment requires owner-verified location metadata; readiness uses stored propertyRef only.',
      )
      return { ok: true, value: { siteMappingOk: true, limitations } }
    default:
      return { ok: false, code: 'VALIDATION', message: 'Unsupported Google provider' }
  }
}

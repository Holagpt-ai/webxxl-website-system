import type { GoogleAnalyticsProviderKey } from '@/lib/platform/google/types'
import type { SeoResult } from '@/lib/platform/seo/types'
import { parseGscPropertyRef } from '@/lib/platform/seo/property-match'

const GA4_PROPERTY = /^properties\/\d+(\/streams\/\d+)?$/
const GBP_LOCATION = /^(locations\/\d+|accounts\/\d+\/locations\/\d+)$/

export function validateGooglePropertyRef(
  provider: GoogleAnalyticsProviderKey,
  propertyRef: string,
): SeoResult<{ normalizedRef: string }> {
  const trimmed = propertyRef.trim()
  if (!trimmed) {
    return { ok: false, code: 'VALIDATION', message: 'Property reference required' }
  }
  switch (provider) {
    case 'GSC': {
      const parsed = parseGscPropertyRef(trimmed)
      if (!parsed.ok) return parsed
      return { ok: true, value: { normalizedRef: trimmed } }
    }
    case 'GA4':
      if (!GA4_PROPERTY.test(trimmed)) {
        return { ok: false, code: 'VALIDATION', message: 'GA4 propertyRef must match properties/{numericId}' }
      }
      return { ok: true, value: { normalizedRef: trimmed } }
    case 'GBP':
      if (!GBP_LOCATION.test(trimmed)) {
        return {
          ok: false,
          code: 'VALIDATION',
          message: 'GBP propertyRef must match locations/{id} or accounts/{id}/locations/{id}',
        }
      }
      return { ok: true, value: { normalizedRef: trimmed } }
    default:
      return { ok: false, code: 'VALIDATION', message: 'Unsupported Google provider' }
  }
}

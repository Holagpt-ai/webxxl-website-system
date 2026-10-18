import { normalizeHostname } from '@/lib/platform/seo/crawl-authorization'
import type { SeoResult } from '@/lib/platform/seo/types'

export type GscPropertyKind = 'DOMAIN' | 'URL_PREFIX'

export function parseGscPropertyRef(propertyRef: string): SeoResult<{ kind: GscPropertyKind; value: string }> {
  if (propertyRef.startsWith('sc-domain:')) {
    return { ok: true, value: { kind: 'DOMAIN', value: normalizeHostname(propertyRef.slice('sc-domain:'.length)) } }
  }
  try {
    const u = new URL(propertyRef.endsWith('/') ? propertyRef : `${propertyRef}/`)
    return { ok: true, value: { kind: 'URL_PREFIX', value: `${u.protocol}//${u.hostname}${u.pathname}` } }
  } catch {
    return { ok: false, code: 'VALIDATION', message: 'Invalid GSC property reference' }
  }
}

/** Match authorized GSC property to managed site hosts without substring guessing. */
export function matchGscPropertyToSite(input: {
  propertyRef: string
  authorizedHosts: string[]
  siteCanonicalUrl?: string | null
}): SeoResult<{ matched: true; kind: GscPropertyKind }> {
  const parsed = parseGscPropertyRef(input.propertyRef)
  if (!parsed.ok) return parsed
  const allowed = new Set(input.authorizedHosts.map(normalizeHostname))
  if (parsed.value.kind === 'DOMAIN') {
    if (!allowed.has(parsed.value.value)) {
      return { ok: false, code: 'FORBIDDEN', message: 'GSC domain property not authorized for site' }
    }
    return { ok: true, value: { matched: true, kind: 'DOMAIN' } }
  }
  try {
    const prefix = new URL(parsed.value.value)
    const host = normalizeHostname(prefix.hostname)
    if (!allowed.has(host)) {
      return { ok: false, code: 'FORBIDDEN', message: 'GSC URL-prefix property host not authorized' }
    }
    if (input.siteCanonicalUrl) {
      const canonical = new URL(input.siteCanonicalUrl.startsWith('http') ? input.siteCanonicalUrl : `https://${input.siteCanonicalUrl}`)
      if (normalizeHostname(canonical.hostname) !== host) {
        return { ok: false, code: 'FORBIDDEN', message: 'GSC URL-prefix host mismatch' }
      }
    }
    return { ok: true, value: { matched: true, kind: 'URL_PREFIX' } }
  } catch {
    return { ok: false, code: 'VALIDATION', message: 'Unable to validate URL-prefix property' }
  }
}

export function denyForeignGoogleProperty(input: {
  connectionAccountId: string
  requestAccountId: string
  propertyRef: string
  authorizedPropertyRefs: string[]
}): SeoResult<true> {
  if (input.connectionAccountId !== input.requestAccountId) {
    return { ok: false, code: 'FORBIDDEN', message: 'Google property belongs to another account' }
  }
  if (!input.authorizedPropertyRefs.includes(input.propertyRef)) {
    return { ok: false, code: 'FORBIDDEN', message: 'Property not linked to this site' }
  }
  return { ok: true, value: true }
}

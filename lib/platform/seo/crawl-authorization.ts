import { SEO_CRAWL_MAX_URL_LENGTH } from '@/config/seo-backend'
import type { SeoResult } from '@/lib/platform/seo/types'

const BLOCKED_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  'metadata.google.internal',
  '169.254.169.254',
])

function isPrivateIpv4(host: string): boolean {
  const parts = host.split('.').map(Number)
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return false
  if (parts[0] === 10) return true
  if (parts[0] === 127) return true
  if (parts[0] === 192 && parts[1] === 168) return true
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true
  if (parts[0] === 169 && parts[1] === 254) return true
  if (parts[0] === 0) return true
  return false
}

/** Block unique-local, link-local, and documented private IPv6 ranges (URL hostname form). */
export function isBlockedIpv6Host(host: string): boolean {
  const h = host.toLowerCase()
  if (h === '::1' || h === '::') return true
  if (h.startsWith('fe80:')) return true
  if (h.startsWith('fc') || h.startsWith('fd')) return true
  if (h.startsWith('[::1]')) return true
  return false
}

export function isBlockedDestinationHost(hostname: string): boolean {
  const host = normalizeHostname(hostname)
  if (BLOCKED_HOSTS.has(host) || host.endsWith('.local')) return true
  if (isPrivateIpv4(host)) return true
  if (host.includes(':') && isBlockedIpv6Host(host)) return true
  return false
}

export function normalizeHostname(host: string): string {
  return host.toLowerCase().replace(/\.$/, '')
}

/** Crawl only verified public hosts on standard HTTP(S) ports. */
export function validateCrawlTargetUrl(input: {
  url: string
  allowedHosts: string[]
}): SeoResult<{ hostname: string; port: number }> {
  if (input.url.length > SEO_CRAWL_MAX_URL_LENGTH) {
    return { ok: false, code: 'CRAWL_BLOCKED', message: 'URL exceeds max length' }
  }
  let parsed: URL
  try {
    parsed = new URL(input.url)
  } catch {
    return { ok: false, code: 'CRAWL_BLOCKED', message: 'Invalid URL' }
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, code: 'CRAWL_BLOCKED', message: 'Only HTTP(S) crawl targets allowed' }
  }
  const port = parsed.port ? Number(parsed.port) : parsed.protocol === 'https:' ? 443 : 80
  if (port !== 80 && port !== 443) {
    return { ok: false, code: 'CRAWL_BLOCKED', message: 'Non-standard port blocked' }
  }
  const hostname = normalizeHostname(parsed.hostname)
  if (isBlockedDestinationHost(hostname)) {
    return { ok: false, code: 'CRAWL_BLOCKED', message: 'Private or local target blocked' }
  }
  const allowed = input.allowedHosts.map(normalizeHostname)
  if (!allowed.includes(hostname)) {
    return { ok: false, code: 'CRAWL_BLOCKED', message: 'Host not in authorized crawl scope' }
  }
  if (parsed.username || parsed.password) {
    return { ok: false, code: 'CRAWL_BLOCKED', message: 'Credential URLs blocked' }
  }
  return { ok: true, value: { hostname, port } }
}

export function validateRedirectTarget(input: {
  fromUrl: string
  toUrl: string
  allowedHosts: string[]
  redirectCount: number
  maxRedirects: number
}): SeoResult<true> {
  if (input.redirectCount > input.maxRedirects) {
    return { ok: false, code: 'CRAWL_BLOCKED', message: 'Redirect limit exceeded' }
  }
  const target = validateCrawlTargetUrl({ url: input.toUrl, allowedHosts: input.allowedHosts })
  if (!target.ok) return target
  return { ok: true, value: true }
}

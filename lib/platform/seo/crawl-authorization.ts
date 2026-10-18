import { isIP } from 'node:net'
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

export type CrawlBlockReason = 'NON_PUBLIC_DESTINATION' | 'SCOPE' | 'PROTOCOL' | 'OTHER'

export function normalizeHostname(host: string): string {
  return host.toLowerCase().replace(/\.$/, '')
}

/** Strip URL hostname brackets so IPv6 literals parse consistently. */
export function unwrapHostnameForIpCheck(hostname: string): string {
  const h = normalizeHostname(hostname)
  if (h.startsWith('[') && h.endsWith(']')) return h.slice(1, -1)
  return h
}

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

function isNonPublicIpv6(ip: string): boolean {
  const h = ip.toLowerCase()
  if (h === '::' || h === '::1') return true
  if (h.startsWith('fe80:') || h.startsWith('fe8') || h.startsWith('fe9') || h.startsWith('fea') || h.startsWith('feb')) {
    return true
  }
  if (h.startsWith('fc') || h.startsWith('fd')) return true
  if (h.startsWith('::ffff:')) {
    const tail = h.slice('::ffff:'.length)
    if (isIP(tail) === 4 && isPrivateIpv4(tail)) return true
    const hexMapped = tail.match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i)
    if (hexMapped) {
      const hi = parseInt(hexMapped[1]!, 16)
      const lo = parseInt(hexMapped[2]!, 16)
      const dotted = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`
      if (isPrivateIpv4(dotted)) return true
    }
  }
  const embeddedIpv4 = h.match(/(\d{1,3}(?:\.\d{1,3}){3})$/)
  if (embeddedIpv4 && isPrivateIpv4(embeddedIpv4[1]!)) return true
  return false
}

/**
 * Destination safety before allowlist checks.
 * Proves private targets are blocked by address class, not missing scope.
 */
export function classifyNonPublicDestination(hostname: string): SeoResult<true> {
  const host = unwrapHostnameForIpCheck(hostname)
  if (BLOCKED_HOSTS.has(host) || host.endsWith('.local')) {
    return { ok: false, code: 'CRAWL_BLOCKED', message: 'Private or local target blocked' }
  }

  const version = isIP(host)
  if (version === 4) {
    if (isPrivateIpv4(host)) {
      return { ok: false, code: 'CRAWL_BLOCKED', message: 'Private or local target blocked' }
    }
    return { ok: true, value: true }
  }
  if (version === 6) {
    if (isNonPublicIpv6(host)) {
      return { ok: false, code: 'CRAWL_BLOCKED', message: 'Private or local target blocked' }
    }
    return { ok: true, value: true }
  }

  return { ok: true, value: true }
}

export function isBlockedDestinationHost(hostname: string): boolean {
  return !classifyNonPublicDestination(hostname).ok
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
  const destination = classifyNonPublicDestination(hostname)
  if (!destination.ok) return destination
  const allowed = input.allowedHosts.map((h) => unwrapHostnameForIpCheck(h))
  const hostForScope = unwrapHostnameForIpCheck(hostname)
  if (!allowed.includes(hostForScope)) {
    return { ok: false, code: 'CRAWL_BLOCKED', message: 'Host not in authorized crawl scope' }
  }
  if (parsed.username || parsed.password) {
    return { ok: false, code: 'CRAWL_BLOCKED', message: 'Credential URLs blocked' }
  }
  return { ok: true, value: { hostname: hostForScope, port } }
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

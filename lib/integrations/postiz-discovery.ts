/**
 * Read-only Postiz endpoint discovery (no API token required).
 */

import { schedulerUrl } from '@/lib/integrations/scheduler'

export type PostizDiscovery = {
  baseUrl: string
  dnsResolvable: boolean | 'unknown'
  httpReachable: boolean
  likelyPostizUi: boolean
  apiRequiresAuth: boolean
  version: null
  socialConnectionsVisible: false
}

export async function discoverPostizEndpoint(baseUrl: string = schedulerUrl): Promise<PostizDiscovery> {
  let httpReachable = false
  let likelyPostizUi = false
  let apiRequiresAuth = true

  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/auth`, {
      method: 'GET',
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    })
    httpReachable = res.ok || res.status === 307 || res.status === 302
    const html = await res.text()
    likelyPostizUi = /Postiz/i.test(html) && /postiz\.com/i.test(html)
  } catch {
    httpReachable = false
  }

  try {
    const api = await fetch(`${baseUrl.replace(/\/$/, '')}/public/v1/me`, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(8000),
    })
    apiRequiresAuth = api.status === 401 || api.status === 403 || api.status === 307 || api.status === 302
  } catch {
    apiRequiresAuth = true
  }

  return {
    baseUrl,
    dnsResolvable: 'unknown',
    httpReachable,
    likelyPostizUi,
    apiRequiresAuth,
    version: null,
    socialConnectionsVisible: false,
  }
}

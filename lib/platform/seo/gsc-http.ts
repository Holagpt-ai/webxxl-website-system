import type { GscSearchAnalyticsRequest, GscSearchAnalyticsResponse } from '@/lib/platform/seo/gsc-types'

export type GscHttpTransport = {
  postJson(input: {
    url: string
    body: GscSearchAnalyticsRequest
    accessTokenRef?: string | null
  }): Promise<{ status: number; json: GscSearchAnalyticsResponse; errorMessage?: string }>
}

export function buildGscSearchAnalyticsUrl(siteUrlEncoded: string): string {
  return `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrlEncoded)}/searchAnalytics/query`
}

export async function queryGscSearchAnalytics(input: {
  transport: GscHttpTransport
  propertyRef: string
  body: GscSearchAnalyticsRequest
  accessTokenRef?: string | null
}): Promise<
  | { ok: true; response: GscSearchAnalyticsResponse }
  | { ok: false; code: 'NOT_CONFIGURED' | 'UNAVAILABLE'; message: string }
> {
  if (!input.accessTokenRef) {
    return { ok: false, code: 'NOT_CONFIGURED', message: 'GSC OAuth not connected' }
  }
  const url = buildGscSearchAnalyticsUrl(input.propertyRef)
  const result = await input.transport.postJson({ url, body: input.body, accessTokenRef: input.accessTokenRef })
  if (result.status === 401 || result.status === 403) {
    return { ok: false, code: 'UNAVAILABLE', message: result.errorMessage ?? 'GSC authorization failed' }
  }
  if (result.status >= 400) {
    return { ok: false, code: 'UNAVAILABLE', message: result.errorMessage ?? `GSC HTTP ${result.status}` }
  }
  return { ok: true, response: result.json }
}

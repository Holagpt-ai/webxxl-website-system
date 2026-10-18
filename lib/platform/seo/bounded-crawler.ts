import {
  SEO_CRAWL_MAX_BODY_BYTES,
  SEO_CRAWL_MAX_BYTES_TOTAL,
  SEO_CRAWL_MAX_DEPTH,
  SEO_CRAWL_MAX_PAGES,
  SEO_CRAWL_MAX_REDIRECTS,
} from '@/config/seo-backend'
import { parseHtmlSeoSignals } from '@/lib/platform/seo/crawl-html-parse'
import { validateCrawlTargetUrl, validateRedirectTarget } from '@/lib/platform/seo/crawl-authorization'
import type { SeoResult } from '@/lib/platform/seo/types'

export type CrawlHttpResponse = {
  status: number
  headers: Record<string, string>
  body: string
  finalUrl: string
}

export type CrawlHttpTransport = {
  fetch(url: string): Promise<CrawlHttpResponse>
}

export type CrawlPageResult = {
  url: string
  httpStatus: number
  parsed: ReturnType<typeof parseHtmlSeoSignals>
  xRobotsTag?: string
  redirectChain: string[]
}

export type BoundedCrawlResult = {
  pages: CrawlPageResult[]
  blockedReason?: string
  bytesDownloaded: number
  duplicateTitles: { title: string; urls: string[] }[]
  brokenInternalLinks: { fromUrl: string; toUrl: string; status: number }[]
}

function headerValue(headers: Record<string, string>, name: string): string | undefined {
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase())
  return key ? headers[key] : undefined
}

export async function runBoundedSiteCrawl(input: {
  seedUrl: string
  allowedHosts: string[]
  transport: CrawlHttpTransport
  maxPages?: number
  maxDepth?: number
}): Promise<SeoResult<BoundedCrawlResult>> {
  const maxPages = input.maxPages ?? SEO_CRAWL_MAX_PAGES
  const maxDepth = input.maxDepth ?? SEO_CRAWL_MAX_DEPTH
  const seedCheck = validateCrawlTargetUrl({ url: input.seedUrl, allowedHosts: input.allowedHosts })
  if (!seedCheck.ok) return seedCheck

  const queue: { url: string; depth: number }[] = [{ url: input.seedUrl, depth: 0 }]
  const visited = new Set<string>()
  const pages: CrawlPageResult[] = []
  let bytesDownloaded = 0
  const titleMap = new Map<string, string[]>()
  const brokenInternal: BoundedCrawlResult['brokenInternalLinks'] = []
  const statusCache = new Map<string, number>()

  async function fetchWithRedirects(url: string): Promise<SeoResult<CrawlHttpResponse>> {
    let current = url
    const chain: string[] = []
    for (let i = 0; i <= SEO_CRAWL_MAX_REDIRECTS; i++) {
      const allowed = validateCrawlTargetUrl({ url: current, allowedHosts: input.allowedHosts })
      if (!allowed.ok) return allowed
      const res = await input.transport.fetch(current)
      if (res.status >= 300 && res.status < 400) {
        const location = headerValue(res.headers, 'location')
        if (!location) return { ok: false, code: 'CRAWL_BLOCKED', message: 'Redirect without location' }
        const next = new URL(location, current).toString()
        const redirectOk = validateRedirectTarget({
          fromUrl: current,
          toUrl: next,
          allowedHosts: input.allowedHosts,
          redirectCount: chain.length + 1,
          maxRedirects: SEO_CRAWL_MAX_REDIRECTS,
        })
        if (!redirectOk.ok) return redirectOk
        chain.push(current)
        current = next
        continue
      }
      return { ok: true, value: { ...res, finalUrl: current } }
    }
    return { ok: false, code: 'CRAWL_BLOCKED', message: 'Redirect limit exceeded' }
  }

  while (queue.length > 0 && pages.length < maxPages) {
    const next = queue.shift()!
    if (visited.has(next.url)) continue
    visited.add(next.url)
    const fetched = await fetchWithRedirects(next.url)
    if (!fetched.ok) {
      return {
        ok: true,
        value: {
          pages,
          blockedReason: fetched.message,
          bytesDownloaded,
          duplicateTitles: [],
          brokenInternalLinks: brokenInternal,
        },
      }
    }
    const bodyBytes = Buffer.byteLength(fetched.value.body, 'utf8')
    if (bodyBytes > SEO_CRAWL_MAX_BODY_BYTES) {
      return {
        ok: true,
        value: {
          pages,
          blockedReason: 'Response body limit exceeded',
          bytesDownloaded,
          duplicateTitles: [],
          brokenInternalLinks: brokenInternal,
        },
      }
    }
    bytesDownloaded += bodyBytes
    if (bytesDownloaded > SEO_CRAWL_MAX_BYTES_TOTAL) {
      return {
        ok: true,
        value: {
          pages,
          blockedReason: 'Total download byte limit exceeded',
          bytesDownloaded,
          duplicateTitles: [],
          brokenInternalLinks: brokenInternal,
        },
      }
    }
    const parsed = parseHtmlSeoSignals(fetched.value.body, fetched.value.finalUrl)
    const xRobots = headerValue(fetched.value.headers, 'x-robots-tag')
    pages.push({
      url: fetched.value.finalUrl,
      httpStatus: fetched.value.status,
      parsed,
      xRobotsTag: xRobots,
      redirectChain: [],
    })
    statusCache.set(fetched.value.finalUrl, fetched.value.status)
    if (parsed.title) {
      const list = titleMap.get(parsed.title) ?? []
      list.push(fetched.value.finalUrl)
      titleMap.set(parsed.title, list)
    }
    if (next.depth < maxDepth) {
      for (const link of parsed.internalLinks) {
        const linkOk = validateCrawlTargetUrl({ url: link, allowedHosts: input.allowedHosts })
        if (linkOk.ok && !visited.has(link)) queue.push({ url: link, depth: next.depth + 1 })
      }
    }
  }

  for (const page of pages) {
    for (const link of page.parsed.internalLinks) {
      if (statusCache.has(link)) {
        const status = statusCache.get(link)!
        if (status >= 400) brokenInternal.push({ fromUrl: page.url, toUrl: link, status })
        continue
      }
      const linkOk = validateCrawlTargetUrl({ url: link, allowedHosts: input.allowedHosts })
      if (!linkOk.ok) continue
      const res = await input.transport.fetch(link)
      statusCache.set(link, res.status)
      if (res.status >= 400) brokenInternal.push({ fromUrl: page.url, toUrl: link, status: res.status })
    }
  }

  const duplicateTitles = [...titleMap.entries()]
    .filter(([, urls]) => urls.length > 1)
    .map(([title, urls]) => ({ title, urls }))

  return { ok: true, value: { pages, bytesDownloaded, duplicateTitles, brokenInternalLinks: brokenInternal } }
}

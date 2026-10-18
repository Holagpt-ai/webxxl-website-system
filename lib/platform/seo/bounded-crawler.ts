import { isSeoCrawlerEnabled } from '@/config/seo-backend'
import { SEO_CRAWL_MAX_DEPTH, SEO_CRAWL_MAX_PAGES } from '@/config/seo-backend'
import { createCrawlBudget, defaultCrawlBudgetLimits } from '@/lib/platform/seo/crawl-budget'
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
  httpRequests: number
  duplicateTitles: { title: string; urls: string[] }[]
  brokenInternalLinks: { fromUrl: string; toUrl: string; status: number }[]
}

function headerValue(headers: Record<string, string>, name: string): string | undefined {
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase())
  return key ? headers[key] : undefined
}

/**
 * All HTTP during a crawl uses this path (including broken-link checks).
 * Live network crawling remains disabled unless SEO_CRAWLER_ENABLED=true
 * and testBypassLiveNetworkGate is not set for synthetic transport tests.
 */
export async function runBoundedSiteCrawl(input: {
  seedUrl: string
  allowedHosts: string[]
  transport: CrawlHttpTransport
  maxPages?: number
  maxDepth?: number
  /** Vitest-only: allow injectable transport when global crawler flag is off. */
  testBypassLiveNetworkGate?: boolean
}): Promise<SeoResult<BoundedCrawlResult>> {
  if (!isSeoCrawlerEnabled() && !input.testBypassLiveNetworkGate) {
    return {
      ok: false,
      code: 'CRAWL_BLOCKED',
      message: 'Live network crawling disabled (SEO_CRAWLER_ENABLED=false); URL validation alone does not imply safe egress',
    }
  }

  const maxPages = input.maxPages ?? SEO_CRAWL_MAX_PAGES
  const maxDepth = input.maxDepth ?? SEO_CRAWL_MAX_DEPTH
  const seedCheck = validateCrawlTargetUrl({ url: input.seedUrl, allowedHosts: input.allowedHosts })
  if (!seedCheck.ok) return seedCheck

  const budget = createCrawlBudget(defaultCrawlBudgetLimits(maxPages))
  const queue: { url: string; depth: number }[] = [{ url: input.seedUrl, depth: 0 }]
  const visited = new Set<string>()
  const pages: CrawlPageResult[] = []
  const titleMap = new Map<string, string[]>()
  const brokenInternal: BoundedCrawlResult['brokenInternalLinks'] = []
  const statusCache = new Map<string, number>()

  async function boundedFetch(url: string, options: { countAsPage: boolean }): Promise<SeoResult<CrawlHttpResponse & { redirectChain: string[] }>> {
    const targetCheck = validateCrawlTargetUrl({ url, allowedHosts: input.allowedHosts })
    if (!targetCheck.ok) return targetCheck
    if (options.countAsPage) {
      const pageBudget = budget.canFetchPage()
      if (!pageBudget.ok) return pageBudget
    }
    let current = url
    const redirectChain: string[] = []
    const limits = defaultCrawlBudgetLimits(maxPages)

    for (let hop = 0; hop <= limits.maxRedirectsPerFetch; hop++) {
      const allowed = validateCrawlTargetUrl({ url: current, allowedHosts: input.allowedHosts })
      if (!allowed.ok) return allowed
      const reqBudget = budget.recordRequest()
      if (!reqBudget.ok) return reqBudget

      const res = await input.transport.fetch(current)
      if (res.status >= 300 && res.status < 400) {
        const location = headerValue(res.headers, 'location')
        if (!location) return { ok: false, code: 'CRAWL_BLOCKED', message: 'Redirect without location' }
        const next = new URL(location, current).toString()
        const redirectOk = validateRedirectTarget({
          fromUrl: current,
          toUrl: next,
          allowedHosts: input.allowedHosts,
          redirectCount: redirectChain.length + 1,
          maxRedirects: limits.maxRedirectsPerFetch,
        })
        if (!redirectOk.ok) return redirectOk
        redirectChain.push(current)
        current = next
        continue
      }

      const bodyBytes = Buffer.byteLength(res.body, 'utf8')
      const bytesOk = budget.recordBodyBytes(bodyBytes)
      if (!bytesOk.ok) return bytesOk
      if (options.countAsPage) budget.state.pagesFetched += 1
      return { ok: true, value: { ...res, finalUrl: current, redirectChain } }
    }
    return { ok: false, code: 'CRAWL_BLOCKED', message: 'Redirect limit exceeded' }
  }

  while (queue.length > 0 && pages.length < maxPages) {
    const next = queue.shift()!
    if (visited.has(next.url)) continue
    visited.add(next.url)
    const fetched = await boundedFetch(next.url, { countAsPage: true })
    if (!fetched.ok) {
      return {
        ok: true,
        value: {
          pages,
          blockedReason: fetched.message,
          bytesDownloaded: budget.state.bytesDownloaded,
          httpRequests: budget.state.httpRequests,
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
      redirectChain: fetched.value.redirectChain,
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
      const fetched = await boundedFetch(link, { countAsPage: false })
      if (!fetched.ok) {
        return {
          ok: true,
          value: {
            pages,
            blockedReason: fetched.message,
            bytesDownloaded: budget.state.bytesDownloaded,
            httpRequests: budget.state.httpRequests,
            duplicateTitles: [],
            brokenInternalLinks: brokenInternal,
          },
        }
      }
      statusCache.set(link, fetched.value.status)
      if (fetched.value.status >= 400) {
        brokenInternal.push({ fromUrl: page.url, toUrl: link, status: fetched.value.status })
      }
    }
  }

  const duplicateTitles = [...titleMap.entries()]
    .filter(([, urls]) => urls.length > 1)
    .map(([title, urls]) => ({ title, urls }))

  return {
    ok: true,
    value: {
      pages,
      bytesDownloaded: budget.state.bytesDownloaded,
      httpRequests: budget.state.httpRequests,
      duplicateTitles,
      brokenInternalLinks: brokenInternal,
    },
  }
}

import {
  SEO_CRAWL_MAX_BODY_BYTES,
  SEO_CRAWL_MAX_BYTES_TOTAL,
  SEO_CRAWL_MAX_REDIRECTS,
} from '@/config/seo-backend'
import type { SeoResult } from '@/lib/platform/seo/types'

export type CrawlBudgetLimits = {
  maxPages: number
  maxHttpRequests: number
  maxBytesTotal: number
  maxRedirectsPerFetch: number
}

export type CrawlBudgetState = {
  pagesFetched: number
  httpRequests: number
  bytesDownloaded: number
}

export function createCrawlBudget(limits: CrawlBudgetLimits): {
  state: CrawlBudgetState
  canFetchPage: () => SeoResult<true>
  recordRequest: () => SeoResult<true>
  recordBodyBytes: (bytes: number) => SeoResult<true>
} {
  const state: CrawlBudgetState = { pagesFetched: 0, httpRequests: 0, bytesDownloaded: 0 }

  return {
    state,
    canFetchPage() {
      if (state.pagesFetched >= limits.maxPages) {
        return { ok: false, code: 'CRAWL_BLOCKED', message: 'Page budget exhausted' }
      }
      return { ok: true, value: true }
    },
    recordRequest() {
      state.httpRequests += 1
      if (state.httpRequests > limits.maxHttpRequests) {
        return { ok: false, code: 'CRAWL_BLOCKED', message: 'HTTP request budget exhausted' }
      }
      return { ok: true, value: true }
    },
    recordBodyBytes(bytes: number) {
      if (bytes > SEO_CRAWL_MAX_BODY_BYTES) {
        return { ok: false, code: 'CRAWL_BLOCKED', message: 'Response body limit exceeded' }
      }
      state.bytesDownloaded += bytes
      if (state.bytesDownloaded > limits.maxBytesTotal) {
        return { ok: false, code: 'CRAWL_BLOCKED', message: 'Total download byte limit exceeded' }
      }
      return { ok: true, value: true }
    },
  }
}

export function defaultCrawlBudgetLimits(maxPages: number): CrawlBudgetLimits {
  const maxHttpRequests = Math.max(maxPages * (SEO_CRAWL_MAX_REDIRECTS + 2), maxPages)
  return {
    maxPages,
    maxHttpRequests,
    maxBytesTotal: SEO_CRAWL_MAX_BYTES_TOTAL,
    maxRedirectsPerFetch: SEO_CRAWL_MAX_REDIRECTS,
  }
}

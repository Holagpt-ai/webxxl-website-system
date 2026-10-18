import { SEO_CRAWL_MAX_DEPTH, SEO_CRAWL_MAX_PAGES } from '@/config/seo-backend'
import type { SeoResult } from '@/lib/platform/seo/types'

export const SEO_SCAN_MAX_CANDIDATE_COMPETITORS = 50

export function normalizeScanResourceLimits(input: {
  maxPages?: number
  maxDepth?: number
}): SeoResult<{ maxPages: number; maxDepth: number }> {
  const pagesRaw = input.maxPages ?? SEO_CRAWL_MAX_PAGES
  const depthRaw = input.maxDepth ?? SEO_CRAWL_MAX_DEPTH
  if (!Number.isFinite(pagesRaw) || !Number.isFinite(depthRaw)) {
    return { ok: false, code: 'VALIDATION', message: 'maxPages and maxDepth must be finite numbers' }
  }
  if (!Number.isInteger(pagesRaw) || !Number.isInteger(depthRaw)) {
    return { ok: false, code: 'VALIDATION', message: 'maxPages and maxDepth must be integers' }
  }
  if (pagesRaw <= 0 || depthRaw <= 0) {
    return { ok: false, code: 'VALIDATION', message: 'maxPages and maxDepth must be positive' }
  }
  return {
    ok: true,
    value: {
      maxPages: Math.min(pagesRaw, SEO_CRAWL_MAX_PAGES),
      maxDepth: Math.min(depthRaw, SEO_CRAWL_MAX_DEPTH),
    },
  }
}

export function buildScanRequestFingerprint(input: {
  operation: string
  maxPages: number
  maxDepth: number
}): string {
  return `${input.operation}:${input.maxPages}:${input.maxDepth}`
}

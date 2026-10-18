/** Synthetic crawl bypass is allowed only under Vitest/test — never in production runtime. */
export function isSyntheticCrawlTestBypass(requested: boolean | undefined): boolean {
  if (!requested) return false
  if (process.env.NODE_ENV === 'production') return false
  return process.env.VITEST === 'true' || process.env.NODE_ENV === 'test'
}

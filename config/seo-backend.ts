function envFlag(name: string, defaultValue = false): boolean {
  const raw = process.env[name]
  if (raw === undefined) return defaultValue
  return raw === '1' || raw.toLowerCase() === 'true'
}

export function isSeoBackendEnabled(): boolean {
  return envFlag('SEO_BACKEND_ENABLED', false)
}

export function isSeoCrawlerEnabled(): boolean {
  return envFlag('SEO_CRAWLER_ENABLED', false)
}

export function isSeoGscApiEnabled(): boolean {
  return envFlag('SEO_GSC_API_ENABLED', false)
}

export function isSeoGoogleOauthEnabled(): boolean {
  return envFlag('SEO_GOOGLE_OAUTH_ENABLED', false)
}

export function isSeoGa4ApiEnabled(): boolean {
  return envFlag('SEO_GA4_API_ENABLED', false)
}

export function isSeoGbpApiEnabled(): boolean {
  return envFlag('SEO_GBP_API_ENABLED', false)
}

export function isSeoPlacesApiEnabled(): boolean {
  return envFlag('SEO_PLACES_API_ENABLED', false)
}

export function isSeoRankProviderEnabled(): boolean {
  return envFlag('SEO_RANK_PROVIDER_ENABLED', false)
}

export function isSeoAiExecutionEnabled(): boolean {
  return envFlag('SEO_AI_EXECUTION_ENABLED', false)
}

export const SEO_CRAWL_MAX_PAGES = Number(process.env.SEO_CRAWL_MAX_PAGES ?? '50')
export const SEO_CRAWL_MAX_DEPTH = Number(process.env.SEO_CRAWL_MAX_DEPTH ?? '3')
export const SEO_CRAWL_MAX_BODY_BYTES = Number(process.env.SEO_CRAWL_MAX_BODY_BYTES ?? '524288')
export const SEO_CRAWL_MAX_BYTES_TOTAL = Number(process.env.SEO_CRAWL_MAX_BYTES_TOTAL ?? '5242880')
export const SEO_CRAWL_MAX_REDIRECTS = Number(process.env.SEO_CRAWL_MAX_REDIRECTS ?? '5')
export const SEO_CRAWL_MAX_URL_LENGTH = Number(process.env.SEO_CRAWL_MAX_URL_LENGTH ?? '2048')
export const SEO_LIST_DEFAULT_TAKE = Number(process.env.SEO_LIST_DEFAULT_TAKE ?? '50')
export const SEO_LIST_MAX_TAKE = Number(process.env.SEO_LIST_MAX_TAKE ?? '100')
export const SEO_GSC_MAX_ROWS = Number(process.env.SEO_GSC_MAX_ROWS ?? '25000')

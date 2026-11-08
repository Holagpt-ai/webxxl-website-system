/** Honest integration boundary — metrics stay in provider-specific sections. */
export const SITE_INTELLIGENCE_PROVENANCE_NOTICE =
  'SEO (stored inventory, GSC, competitors) and Analytics (GA4 sessions, GSC search, GBP local) are separate providers. Do not combine clicks with sessions or treat GSC average position as fixed rank.'

export const SITE_INTELLIGENCE_SOURCE_MODULES = [
  'seo.overview',
  'analytics.overview',
  'google.readiness',
] as const

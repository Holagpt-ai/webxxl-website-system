/** Normalized metric definition keys stored in SeoMetricObservation.metricDefinition */
export const ANALYTICS_GA4_METRICS = {
  sessions: 'ga4.sessions',
  users: 'ga4.activeUsers',
  conversions: 'ga4.conversions',
} as const

export const ANALYTICS_GA4_ACQUISITION_DIMENSION = 'sessionDefaultChannelGroup'

export const ANALYTICS_GBP_METRICS = {
  views: 'gbp.businessProfileViews',
  searches: 'gbp.businessSearchQueries',
  actions: 'gbp.businessActions',
} as const

export function acquisitionMetricDefinition(channel: string): string {
  return `ga4.acquisition.${channel}`
}

import type { AnalyticsFreshnessState, AnalyticsProviderKey } from '@/lib/platform/analytics/types'

export type AnalyticsFeatureFlagsDto = {
  backendEnabled: boolean
  ingestionEnabled: boolean
  firstPartyCaptureEnabled: boolean
  seoGscApiEnabled: boolean
  seoGa4ApiEnabled: boolean
  seoGbpApiEnabled: boolean
  seoGoogleOauthEnabled: boolean
}

export type AnalyticsPropertyConnectionDto = {
  managedSiteId: string
  siteName: string
  domain: string
  provider: AnalyticsProviderKey
  propertyRef: string
  propertyKind: string
  verificationState: string
  dataState: AnalyticsFreshnessState
  lastVerifiedAt: string | null
  updatedAt: string
}

export type AnalyticsSourceFreshnessDto = {
  provider: AnalyticsProviderKey | string
  dataState: AnalyticsFreshnessState
  observedAt: string | null
  timezone: string
}

export type AnalyticsTrafficSeriesPointDto = {
  date: string
  sessions: number | null
  users: number | null
  dataState: AnalyticsFreshnessState
}

export type AnalyticsAcquisitionRowDto = {
  channel: string
  sessions: number | null
  dataState: AnalyticsFreshnessState
}

export type AnalyticsSearchPerformanceDto = {
  dataState: AnalyticsFreshnessState
  propertyRef?: string
  clicks: number | null
  impressions: number | null
  ctr: number | null
  averagePosition: number | null
  averagePositionLabel: string
  dateRange?: { start: string; end: string }
  asOf?: string
}

export type AnalyticsLocalPerformanceDto = {
  dataState: AnalyticsFreshnessState
  profileViews: number | null
  searchQueries: number | null
  actions: number | null
  rankObservations: number
  limitations: string[]
}

export type AnalyticsConversionSummaryRowDto = {
  conversionKey: string
  displayName: string
  count: number
  /** Distinct session/visitor conversions when first-party refs are present; otherwise equals count. */
  uniqueCount?: number
  rate: number | null
  dataState: AnalyticsFreshnessState
  sourceProvider: string
}

export type AnalyticsPeriodChangeDto = {
  metric: string
  current: number | null
  previous: number | null
  absoluteChange: number | null
  percentChange: number | null
  dataState: AnalyticsFreshnessState
  note?: string
}

export type AnalyticsCrmRelationshipDto = {
  leadsCreated: number
  leadsConverted: number
  openDeals: number
  dataState: AnalyticsFreshnessState
  disclaimer: string
}

export type AnalyticsOverviewDto = {
  customerAccountId: string
  managedSiteId: string | null
  timezone: string
  flags: AnalyticsFeatureFlagsDto
  freshness: AnalyticsSourceFreshnessDto[]
  traffic: {
    dataState: AnalyticsFreshnessState
    series: AnalyticsTrafficSeriesPointDto[]
    periodChanges: AnalyticsPeriodChangeDto[]
  }
  search: AnalyticsSearchPerformanceDto
  local: AnalyticsLocalPerformanceDto
  conversions: AnalyticsConversionSummaryRowDto[]
  acquisition: AnalyticsAcquisitionRowDto[]
  crm: AnalyticsCrmRelationshipDto
  sync: AnalyticsSyncStatusDto
}

export type AnalyticsSyncRunDto = {
  provider: string
  status: string
  dataState: AnalyticsFreshnessState
  scheduledAt: string
  processedAt: string | null
  errorClass: string | null
}

export type AnalyticsSyncStatusDto = {
  dataState: AnalyticsFreshnessState
  runs: AnalyticsSyncRunDto[]
  ingestionEnabled: boolean
}

export type AnalyticsTrendPointDto = {
  date: string
  value: number | null
  dataState: AnalyticsFreshnessState
}

export type AnalyticsTrendSeriesDto = {
  metric: string
  provider: string
  timezone: string
  points: AnalyticsTrendPointDto[]
}

import type { SeoAnalyticsProvider } from '@prisma/client'
import type { AnalyticsDateRange } from '@/lib/platform/analytics/date-range'

export type AnalyticsConnectionRow = {
  managedSiteId: string
  siteName: string
  domain: string
  provider: SeoAnalyticsProvider
  propertyRef: string
  propertyKind: string
  verificationState: string
  dataState: string
  lastVerifiedAt: Date | null
  updatedAt: Date
}

export type AnalyticsMetricRow = {
  metricDefinition: string
  dimension: string | null
  dimensionValue: string | null
  value: number | null
  dataState: string
  date: Date | null
  observedAt: Date
}

export type AnalyticsConversionDefRow = {
  id: string
  publicId: string
  key: string
  displayName: string
  isActive: boolean
  sourceKind: string
}

export type AnalyticsConversionObsRow = {
  conversionKey: string
  displayName: string
  count: number
  sourceProvider: string
  dataState: string
}

export type AnalyticsSyncRunRow = {
  provider: string
  status: string
  dataState: string
  scheduledAt: Date
  processedAt: Date | null
  errorClass: string | null
}

export type AnalyticsStore = {
  isStaff(userId: string, platformRole: string): boolean
  hasOperatingMembership(userId: string, customerAccountId: string): Promise<boolean>
  resolveManagedSite(customerAccountId: string, managedSiteId: string | null): Promise<{ id: string; name: string; domain: string } | null>
  listConnections(customerAccountId: string, managedSiteId?: string | null): Promise<AnalyticsConnectionRow[]>
  listMetrics(input: {
    customerAccountId: string
    managedSiteId: string
    provider: SeoAnalyticsProvider
    range: AnalyticsDateRange
    metricDefinitions?: string[]
  }): Promise<AnalyticsMetricRow[]>
  listKeywordObservations(input: {
    customerAccountId: string
    managedSiteId: string
    range: AnalyticsDateRange
  }): Promise<
    {
      clicks: number | null
      impressions: number | null
      ctr: number | null
      averagePosition: number | null
      date: Date
      dataState: string
      idempotencyKey: string
    }[]
  >
  countLocalRankObservations(managedSiteId: string, range: AnalyticsDateRange): Promise<number>
  listConversionDefinitions(customerAccountId: string, managedSiteId: string): Promise<AnalyticsConversionDefRow[]>
  summarizeConversions(input: {
    customerAccountId: string
    managedSiteId: string
    range: AnalyticsDateRange
  }): Promise<AnalyticsConversionObsRow[]>
  listSyncRuns(customerAccountId: string, managedSiteId: string): Promise<AnalyticsSyncRunRow[]>
  crmCounts(customerAccountId: string, range: AnalyticsDateRange): Promise<{
    leadsCreated: number
    leadsConverted: number
    openDeals: number
  }>
}

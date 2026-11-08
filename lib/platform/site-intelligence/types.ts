import type { AnalyticsOverviewDto } from '@/lib/platform/analytics/dto'
import type { GoogleSiteReadinessDto } from '@/lib/platform/google/types'
import type { SeoSiteOverviewDto } from '@/lib/platform/seo/dashboard-read-model'
import type { SITE_INTELLIGENCE_SOURCE_MODULES } from '@/lib/platform/site-intelligence/constants'

export type SiteIntelligenceSourceModule = (typeof SITE_INTELLIGENCE_SOURCE_MODULES)[number]

export type SiteIntelligenceSlice<T> =
  | {
      status: 'AVAILABLE'
      sourceModule: SiteIntelligenceSourceModule
      data: T
    }
  | {
      status: 'UNAVAILABLE'
      sourceModule: SiteIntelligenceSourceModule
      reasonCode: string
      message: string
    }

export type SiteIntelligenceSummaryResponse = {
  customerAccountId: string
  managedSiteId: string
  assembledAt: string
  dateRange: { start: string; end: string; timezone: string }
  provenanceNotice: string
  seo: SiteIntelligenceSlice<SeoSiteOverviewDto>
  analytics: SiteIntelligenceSlice<AnalyticsOverviewDto>
  googleReadiness: SiteIntelligenceSlice<GoogleSiteReadinessDto>
}

const enc = encodeURIComponent
const site = (id: string) => `/api/v1/seo/sites/${enc(id)}`

export const SEO_API = {
  overview: (id: string) => `${site(id)}/overview`,
  pages: (id: string) => `${site(id)}/pages`,
  findings: (id: string) => `${site(id)}/findings`,
  scanPreviews: (id: string) => `${site(id)}/scan-previews`,
  performance: (id: string) => `${site(id)}/performance`,
  competitors: (id: string) => `${site(id)}/competitors`,
  markets: (id: string) => `${site(id)}/markets`,
  opportunities: (id: string) => `${site(id)}/opportunities`,
  connections: (id: string) => `${site(id)}/connections`,
}

export type SeoDataState = 'NOT_CONNECTED' | 'FETCHING' | 'READY' | 'PARTIAL' | 'STALE' | 'ERROR' | 'NOT_SUPPORTED'

export type SeoOpportunityDraft = {
  ruleId: string
  ruleVersion: string
  severity: string
  confidence: string
  impactRationale: string
  effortCategory: string
  recommendation: string
  affectedUrl?: string
  evidenceRef: string
  source: string
  observedAt: string
  priorityScore: number
  state: string
}

export type RankedCompetitor = {
  displayName: string
  placeId?: string | null
  rankScore: number
  source: string
  evidenceRef?: string
}

export type SeoOverview = {
  managedSiteId: string
  canonicalHost?: string
  sections: {
    overview: { dataState: SeoDataState; lastObservedAt?: string }
    connections: { provider: string; propertyRef?: string; dataState: SeoDataState; verificationState: string }[]
    pageCounts: {
      discovered: number
      crawled: number
      draft: number
      preview: number
      published: number
      removed: number
      unverified: number
      publishedOnlyWhenVerified: number
      dataState: SeoDataState
    }
    gscPerformance: { dataState: SeoDataState }
    technicalFindings: { count: number; dataState: SeoDataState }
    competitorMarket: { competitors: RankedCompetitor[]; dataState: SeoDataState }
    priorityOpportunities: SeoOpportunityDraft[]
    workPerformed: { count: number; dataState: SeoDataState }
    sourceFreshness: { providers: { provider: string; dataState: SeoDataState; observedAt?: string }[] }
    outstandingActions: { count: number }
  }
}

export type GscPerformance = {
  dataState: SeoDataState
  propertyRef?: string
  dateRange?: { start: string; end: string }
  asOf?: string
  clicks: number | null
  impressions: number | null
  ctr: number | null
  averagePosition: number | null
  averagePositionLabel: string
  completeness: {
    rowCount: number
    dedupedRowCount: number
    distinctDates: number
    aggregationMethod: string
    limitations: string[]
  }
}

export type SitePage = {
  id: string
  url: string
  normalizedPath: string
  status: string
  httpStatus: number | null
  title: string | null
  lastCrawledAt: string | null
  lastPublishedAt: string | null
}

export type PageFinding = {
  id: string
  ruleId: string
  severity: string
  url: string
  observedAt: string
}

export type ScanPreviewResult = { crawlRunId: string; status: 'PREPARED' | 'BLOCKED'; message: string }

export type CompetitorMarket = {
  id: string
  name: string
  category: string
  radiusKm: number | null
  language: string
  sourceMethod: string
  createdAt: string
}

export type CompetitorProfile = {
  id: string
  marketId: string
  displayName: string
  rankScore: number
  source: string
  evidenceRef: string | null
}

export type CreateMarketResult = { marketId: string; competitors: RankedCompetitor[] }

export type SeoOpportunity = {
  id: string
  ruleId: string
  state: string
  severity: string
  confidence: string
  impactRationale: string
  effortCategory: string
  recommendation: string
  affectedUrl: string | null
  source: string
  observedAt: string
  priorityScore: number
}

export type SeoConnection = {
  id: string
  provider: string
  propertyRef: string | null
  propertyKind: string | null
  verificationState: string
  dataState: SeoDataState
  lastVerifiedAt: string | null
  revokedAt: string | null
}

/** Only the Prisma JSON keys the Marketing Studio screens read. Dates arrive as ISO strings. */

const enc = encodeURIComponent

export const MKT_API = {
  requests: '/api/v1/marketing/requests',
  request: (id: string) => `/api/v1/marketing/requests/${enc(id)}`,
  requestArtifacts: (id: string) => `/api/v1/marketing/requests/${enc(id)}/artifacts`,
  prepare: (id: string) => `/api/v1/marketing/requests/${enc(id)}/prepare`,
  artifact: (id: string) => `/api/v1/marketing/artifacts/${enc(id)}`,
  revisions: (id: string) => `/api/v1/marketing/artifacts/${enc(id)}/revisions`,
  submitReview: (id: string) => `/api/v1/marketing/artifacts/${enc(id)}/submit-review`,
  decide: (reviewId: string) => `/api/v1/marketing/reviews/${enc(reviewId)}/decide`,
  followUps: '/api/v1/marketing/follow-ups',
  evaluate: '/api/v1/marketing/follow-ups/evaluate',
  prepareTask: (id: string) => `/api/v1/marketing/follow-ups/${enc(id)}/prepare-task`,
  brandContext: (siteId: string) => `/api/v1/marketing/sites/${enc(siteId)}/brand-context`,
  campaigns: '/api/v1/social/campaigns',
  campaignRevisions: (id: string) => `/api/v1/social/campaigns/${enc(id)}/revisions`,
  calendar: '/api/v1/social/calendar',
  publications: '/api/v1/social/publications',
  connections: '/api/v1/social/connections',
} as const

export const REQUEST_CATEGORIES = [
  'LANDING_PAGE',
  'SEO_CONTENT_FIX',
  'AD_CREATIVE',
  'SOCIAL_CONTENT_PLAN',
  'CAMPAIGN_PREPARATION',
  'CRM_LEAD_FOLLOW_UP',
] as const

export const SOCIAL_PLATFORMS = ['instagram', 'facebook', 'linkedin', 'x', 'tiktok', 'youtube'] as const

export type MarketingRequest = {
  id: string
  managedSiteId: string | null
  requestType: string
  status: string
  brief: string
  locale: string
  audience: string | null
  goal: string | null
  seoOpportunityId: string | null
  createdAt: string
  updatedAt: string
}

export type MarketingArtifact = {
  id: string
  marketingRequestId: string | null
  artifactType: string
  revisionHash: string
  payload: unknown
  generationMode: string
  reviewStatus: string
  locale: string
  safetyClass: string
  createdAt: string
}

export type MarketingArtifactRevision = {
  id: string
  revisionNumber: number
  revisionHash: string
  structuredContent: unknown
  generationMode: string
  createdAt: string
}

export type FollowUpEvaluation = {
  id: string
  crmContactId: string
  coverageState: string
  dueAt: string | null
  recommendedAction: string | null
  resolutionState: string
  lastEvaluatedAt: string
}

export type EvaluateResult = {
  rows: { contactId: string; coverageState: string; dueAt?: string; recommendedAction?: string }[]
  summary: Record<string, number>
}

export type BrandContextVersion = {
  id: string
  versionNumber: number
  businessName: string
  audience: string | null
  brandTone: string | null
  locale: string
  approvedServices: unknown
  approvedClaims: unknown
  complianceReviewState: string
  createdAt: string
}

export type SocialCampaign = {
  id: string
  goal: string
  targetAudience: string | null
  locale: string
  targetPlatforms: unknown
  startDate: string | null
  endDate: string | null
  status: string
  activeRevisionId: string | null
  approvedRevisionId: string | null
  createdAt: string
  updatedAt: string
}

export type SocialPublication = {
  id: string
  campaignId: string
  channelId: string
  status: string
  publishedUrl: string | null
  publishedAt: string | null
  createdAt: string
}

export type SocialConnection = {
  id: string
  platform: string
  displayName: string
  connectionState: string
  lastVerifiedAt: string | null
  revokedAt: string | null
}

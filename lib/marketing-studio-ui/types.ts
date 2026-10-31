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
  artifacts: '/api/v1/marketing/artifacts',
  reviews: '/api/v1/marketing/reviews',
  followUps: '/api/v1/marketing/follow-ups',
  evaluate: '/api/v1/marketing/follow-ups/evaluate',
  prepareTask: (id: string) => `/api/v1/marketing/follow-ups/${enc(id)}/prepare-task`,
  brandContext: (siteId: string) => `/api/v1/marketing/sites/${enc(siteId)}/brand-context`,
  campaigns: '/api/v1/social/campaigns',
  campaignRevisions: (id: string) => `/api/v1/social/campaigns/${enc(id)}/revisions`,
  calendar: '/api/v1/social/calendar',
  publications: '/api/v1/social/publications',
  connections: '/api/v1/social/connections',
  crmSegments: '/api/v1/marketing/crm-segments',
  audiencePreview: (segmentId: string) => `/api/v1/marketing/crm-segments/${enc(segmentId)}/audience-preview`,
} as const

/** `GET /api/v1/marketing/crm-segments` (MKT-25 §1). */
export type CrmSegmentOption = {
  id: string
  name: string
  kind: string
  updatedAt: string
  audiencePlanningEligible: boolean
}

/** Independent, possibly overlapping buckets. They never add up to the total by design. */
export type AudienceBuckets = {
  totalMatchedContacts: number
  marketingConsentGrantedContacts: number
  revokedExpiredOrSuppressedContacts: number
  unknownMarketingConsentContacts: number
  missingUsableEmailContacts: number
}

/** `POST /api/v1/marketing/crm-segments/{id}/audience-preview` (MKT-25 §2); also the stored request snapshot. */
export type AudiencePreview = {
  segmentId: string
  segmentName: string
  segmentKind: string
  segmentUpdatedAt: string
  evaluatedAt: string
  planningOnly: true
  notSendAuthorization: true
  accountContactCount: number
  audience: AudienceBuckets
  disclosures?: {
    synchronousEvaluationLimit?: number
    limitAppliesToActiveContactsInAccount?: boolean
    consentStatesArePointInTime?: boolean
    outboundExecutionRequiresFreshEvaluation?: boolean
  }
}

/** `POST /api/v1/marketing/requests` with `crmSegmentId` (MKT-25 §3). */
export type CampaignPreparationCreated = {
  requestId: string
  status: string
  crmSegmentId: string
  audiencePreview: AudiencePreview
}

/** Mirrors the backend's stored-snapshot guard so a malformed row is never rendered as evidence. */
export function parseAudienceSnapshot(value: unknown): AudiencePreview | null {
  if (!value || typeof value !== 'object') return null
  const c = value as Partial<AudiencePreview>
  if (typeof c.segmentId !== 'string' || typeof c.evaluatedAt !== 'string') return null
  if (c.planningOnly !== true || c.notSendAuthorization !== true) return null
  if (!c.audience || typeof c.audience !== 'object') return null
  return c as AudiencePreview
}

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
  /** Present after the Batch 25 migration; absent on older rows and environments. */
  crmSegmentId?: string | null
  audienceEvaluatedAt?: string | null
  audiencePlanningSummary?: unknown
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

export const ARTIFACT_TYPES = [
  'SOCIAL_CAMPAIGN',
  'SOCIAL_POST',
  'LANDING_PAGE',
  'AD_CREATIVE',
  'SEO_FIX',
  'CAMPAIGN_PLAN',
] as const

export const ARTIFACT_REVIEW_STATUSES = ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'EXPIRED', 'REVOKED'] as const

/** Effective buckets accepted by `GET /api/v1/marketing/reviews?status=`. `SUBMITTED` means non-expired pending. */
export const REVIEW_INBOX_STATUSES = ['SUBMITTED', 'APPROVED', 'REJECTED', 'REVOKED', 'EXPIRED'] as const

export const MKT_PAGE_SIZE = 50

/** `GET /api/v1/marketing/artifacts` items omit `payload` and revision bodies. */
export type MarketingArtifactListItem = {
  id: string
  managedSiteId: string | null
  marketingRequestId: string | null
  artifactType: string
  revisionHash: string
  generationMode: string
  reviewStatus: string
  locale: string
  safetyClass: string
  createdAt: string
}

export type MarketingArtifactListResponse = { artifacts: MarketingArtifactListItem[]; nextCursor?: string }

export type MarketingReview = {
  id: string
  marketingArtifactId: string
  marketingRequestId: string
  managedSiteId: string | null
  revisionHash: string
  status: string
  effectiveStatus: string
  intendedAction: string
  allowedChannel: string | null
  allowedTarget: string | null
  policyVersion: string
  expiresAt: string | null
  decidedAt: string | null
  revokedAt: string | null
  createdAt: string
  approverUserId: string | null
  allowedActions: {
    canDecide: boolean
    intendedAction: string
    allowedChannel: string | null
    allowedTarget: string | null
  }
}

export type MarketingReviewListResponse = { reviews: MarketingReview[]; nextCursor?: string }

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

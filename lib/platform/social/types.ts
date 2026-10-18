export type SocialPlatformKey =
  | 'instagram'
  | 'facebook'
  | 'linkedin'
  | 'x'
  | 'tiktok'
  | 'youtube'

export type SocialChannelConnectionState =
  | 'NOT_CONNECTED'
  | 'PENDING_AUTHORIZATION'
  | 'CONNECTED'
  | 'DEGRADED'
  | 'EXPIRED'
  | 'REVOKED'
  | 'UNAVAILABLE'

export type SocialCampaignStatus =
  | 'DRAFT'
  | 'AWAITING_APPROVAL'
  | 'APPROVED'
  | 'SCHEDULING'
  | 'SCHEDULED'
  | 'PUBLISHING'
  | 'PUBLISHED'
  | 'FAILED'
  | 'CANCELLED'

export type SocialPublicationStatus =
  | 'PENDING'
  | 'SCHEDULED'
  | 'SCHEDULING_UNKNOWN'
  | 'PUBLISHING'
  | 'PUBLISHED'
  | 'FAILED'
  | 'CANCELLED'
  | 'RECONCILIATION_REQUIRED'

export type MarketingRequestType =
  | 'SOCIAL_CAMPAIGN'
  | 'SOCIAL_POST'
  | 'LANDING_PAGE'
  | 'AD_CREATIVE'
  | 'SEO_FIX'
  | 'CAMPAIGN_PLAN'

export type MarketingRequestStatus = 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'COMPLETED'

export type MarketingArtifactType =
  | 'SOCIAL_CAMPAIGN'
  | 'SOCIAL_POST'
  | 'LANDING_PAGE'
  | 'AD_CREATIVE'
  | 'SEO_FIX'
  | 'CAMPAIGN_PLAN'

export type SocialResult<T> = { ok: true; value: T } | { ok: false; code: string; message: string }

export type SocialProviderWorkspaceMappingRecord = {
  id: string
  customerAccountId: string
  managedSiteId?: string
  providerKey: string
  externalWorkspaceRef: string
  secretRef: string
  connectionState: SocialChannelConnectionState
  authorizedByUserId?: string
  lastVerifiedAt?: Date
  revokedAt?: Date
  createdAt: Date
  updatedAt: Date
}

export type BusinessSocialConnectionRecord = {
  id: string
  customerAccountId: string
  managedSiteId?: string
  workspaceMappingId: string
  providerKey: string
  platform: SocialPlatformKey
  externalChannelRef: string
  displayName: string
  connectionState: SocialChannelConnectionState
  permissions?: Record<string, unknown>
  secretRef?: string
  lastVerifiedAt?: Date
  revokedAt?: Date
  createdAt: Date
  updatedAt: Date
}

export type SocialCampaignRecord = {
  id: string
  customerAccountId: string
  managedSiteId?: string
  createdByUserId: string
  goal: string
  targetAudience?: string
  brandProfile?: string
  locale: 'en' | 'es'
  targetPlatforms: SocialPlatformKey[]
  startDate?: Date
  endDate?: Date
  status: SocialCampaignStatus
  activeRevisionId?: string
  approvedRevisionId?: string
  errorCode?: string
  createdAt: Date
  updatedAt: Date
}

export type SocialCampaignRevisionRecord = {
  id: string
  campaignId: string
  revisionNumber: number
  contentHash: string
  captionEn: string
  captionEs?: string
  mediaRefs: string[]
  platformPayloads: Record<string, unknown>
  targetChannelIds: string[]
  scheduledAt?: Date
  createdAt: Date
}

export type SocialCampaignApprovalRecord = {
  id: string
  campaignId: string
  revisionId: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'REVOKED'
  approverUserId?: string
  contentHash: string
  approvedScope: Record<string, unknown>
  policyVersion: string
  expiresAt: Date
  maxUses: number
  useCount: number
  decidedAt?: Date
  createdAt: Date
  updatedAt: Date
}

export type SocialSchedulingIntentRecord = {
  id: string
  idempotencyKey: string
  campaignId: string
  revisionId: string
  approvalId: string
  customerAccountId: string
  channelId: string
  scheduledAt: Date
  status: 'PENDING' | 'DISPATCHED' | 'ACKNOWLEDGED' | 'UNKNOWN' | 'FAILED' | 'CANCELLED'
  externalPostRef?: string
  dispatchLeaseOwner?: string
  lastErrorCode?: string
  createdAt: Date
  updatedAt: Date
}

export type SocialPublicationRecord = {
  id: string
  campaignId: string
  revisionId: string
  schedulingIntentId: string
  customerAccountId: string
  channelId: string
  status: SocialPublicationStatus
  externalPostRef?: string
  publishedUrl?: string
  publishedAt?: Date
  metrics?: Record<string, number>
  createdAt: Date
  updatedAt: Date
}

export type SocialPublicationEventRecord = {
  id: string
  publicationId: string
  eventKind: string
  detail?: Record<string, unknown>
  createdAt: Date
}

export type MarketingRequestRecord = {
  id: string
  customerAccountId: string
  managedSiteId?: string
  requestType: MarketingRequestType
  status: MarketingRequestStatus
  brief: string
  locale: 'en' | 'es'
  audience?: string
  goal?: string
  sourceRefs: string[]
  artifactIds: string[]
  createdByUserId: string
  createdAt: Date
  updatedAt: Date
}

export type MarketingArtifactRecord = {
  id: string
  customerAccountId: string
  managedSiteId?: string
  artifactType: MarketingArtifactType
  revisionHash: string
  payload: Record<string, unknown>
  provenance: string
  createdAt: Date
}

export type MarketingStudioUsageRecord = {
  id: string
  customerAccountId: string
  managedSiteId?: string
  periodKey: string
  operation: string
  units: number
  source: string
  idempotencyKey?: string
  createdAt: Date
}

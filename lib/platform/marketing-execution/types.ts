import type { CrmSegmentAudiencePreview } from '@/lib/platform/marketing/crm-segment-audience-service'
export type MarketingSocialChannelSummary = {
  connectionId: string
  platform: string
  displayName: string
  connectionState: string
  dispatchAllowed: boolean
  blockReason?: string
}
import type { MARKETING_EXECUTION_SOURCE_MODULES } from '@/lib/platform/marketing-execution/constants'

export type MarketingExecutionSourceModule = (typeof MARKETING_EXECUTION_SOURCE_MODULES)[number]

export type MarketingExecutionSlice<T> =
  | {
      status: 'AVAILABLE'
      sourceModule: MarketingExecutionSourceModule
      data: T
    }
  | {
      status: 'UNAVAILABLE'
      sourceModule: MarketingExecutionSourceModule
      reasonCode: string
      message: string
    }

export type MarketingWorkflowLifecycleCounts = {
  requestStatus: Record<string, number>
  reviewEffectiveStatus: Record<string, number>
  publicationStatus: Record<string, number>
  executionLadder: {
    DRAFT: number
    SUBMITTED: number
    APPROVED: number
    PREPARED: number
    SCHEDULED: number
    PUBLISHED: number
    RECONCILIATION_REQUIRED: number
  }
}

export type MarketingReviewEvidenceRow = {
  reviewId: string
  marketingRequestId: string
  marketingArtifactId: string
  managedSiteId: string | null
  effectiveStatus: string
  revisionHash: string
  expiresAt: string | null
  decidedAt: string | null
  revokedAt: string | null
  allowedChannel: string | null
}

export type CrmAudiencePlanningSliceData = {
  planningOnly: true
  notSendAuthorization: true
  segmentCatalogCount: number
  eligibleSegmentCount: number
  latestPreview: Pick<
    CrmSegmentAudiencePreview,
    'segmentId' | 'segmentName' | 'evaluatedAt' | 'audience' | 'disclosures'
  > | null
}

export type SocialHandoffPolicySliceData = {
  dispatchBlocked: boolean
  handoffMode: 'PREPARATION_ONLY'
  livePublishingEnabled: boolean
  postizApiEnabled: boolean
}

export type MarketingExecutionSummaryResponse = {
  customerAccountId: string
  managedSiteId: string | null
  assembledAt: string
  accountScope: 'session_membership'
  provenanceNotice: string
  planningDisclosure: string
  workflowCounts: MarketingExecutionSlice<MarketingWorkflowLifecycleCounts>
  reviewEvidence: MarketingExecutionSlice<{ items: MarketingReviewEvidenceRow[]; truncated: boolean }>
  crmAudiencePlanning: MarketingExecutionSlice<CrmAudiencePlanningSliceData>
  socialProviderReadiness: MarketingExecutionSlice<{
    assessedAt: string
    moduleEnabled: boolean
    postizApiEnabled: boolean
    livePublishingEnabled: boolean
    credentialsConfigured: boolean
    workspaceConnected: boolean
    dispatchBlockedCode: string
    dispatchBlockedMessage: string
    channels: MarketingSocialChannelSummary[]
  }>
  socialHandoffPolicy: MarketingExecutionSlice<SocialHandoffPolicySliceData>
}

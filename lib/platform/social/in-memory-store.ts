import type {
  BusinessSocialConnectionRecord,
  MarketingArtifactRecord,
  MarketingRequestRecord,
  MarketingStudioUsageRecord,
  SocialCampaignApprovalRecord,
  SocialCampaignRecord,
  SocialCampaignRevisionRecord,
  SocialProviderWorkspaceMappingRecord,
  SocialPublicationEventRecord,
  SocialPublicationRecord,
  SocialSchedulingIntentRecord,
} from '@/lib/platform/social/types'

export type TrustedSocialApproverRegistration = { platformWide: boolean }

export type SocialStore = {
  workspaceMappings: Map<string, SocialProviderWorkspaceMappingRecord>
  connections: Map<string, BusinessSocialConnectionRecord>
  campaigns: Map<string, SocialCampaignRecord>
  revisions: Map<string, SocialCampaignRevisionRecord>
  approvals: Map<string, SocialCampaignApprovalRecord>
  schedulingIntents: Map<string, SocialSchedulingIntentRecord>
  schedulingByIdempotency: Map<string, string>
  publications: Map<string, SocialPublicationRecord>
  publicationEvents: SocialPublicationEventRecord[]
  marketingRequests: Map<string, MarketingRequestRecord>
  marketingArtifacts: Map<string, MarketingArtifactRecord>
  usage: MarketingStudioUsageRecord[]
  operatingMemberships: { userId: string; customerAccountId: string }[]
  billingGroupSiblingAccounts: Map<string, string[]>
  trustedApprovers: Map<string, TrustedSocialApproverRegistration>
  postizSecrets: Map<string, string>
}

export function createSocialStore(): SocialStore {
  return {
    workspaceMappings: new Map(),
    connections: new Map(),
    campaigns: new Map(),
    revisions: new Map(),
    approvals: new Map(),
    schedulingIntents: new Map(),
    schedulingByIdempotency: new Map(),
    publications: new Map(),
    publicationEvents: [],
    marketingRequests: new Map(),
    marketingArtifacts: new Map(),
    usage: [],
    operatingMemberships: [],
    billingGroupSiblingAccounts: new Map(),
    trustedApprovers: new Map(),
    postizSecrets: new Map(),
  }
}

export function nextSocialId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 12)}`
}

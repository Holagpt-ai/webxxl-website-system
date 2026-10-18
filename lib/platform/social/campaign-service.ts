import { isSocialMarketingEnabled } from '@/config/social-marketing'
import { stableSocialContentHash } from '@/lib/platform/social/hash'
import { nextSocialId, type SocialStore } from '@/lib/platform/social/in-memory-store'
import { assertWithinQuota, recordMarketingStudioUsage } from '@/lib/platform/social/quota-service'
import { assertSocialCampaignTransition } from '@/lib/platform/social/transitions'
import type {
  SocialCampaignRecord,
  SocialCampaignRevisionRecord,
  SocialCampaignStatus,
  SocialPlatformKey,
  SocialResult,
} from '@/lib/platform/social/types'

export function createSocialCampaign(
  store: SocialStore,
  input: {
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
  },
): SocialResult<SocialCampaignRecord> {
  if (!isSocialMarketingEnabled()) {
    return { ok: false, code: 'SOCIAL_MARKETING_DISABLED', message: 'Marketing Studio backend is disabled' }
  }
  const quota = assertWithinQuota(store, input.customerAccountId, 'draft')
  if (!quota.ok) return quota
  const campaign: SocialCampaignRecord = {
    id: nextSocialId('socamp'),
    customerAccountId: input.customerAccountId,
    managedSiteId: input.managedSiteId,
    createdByUserId: input.createdByUserId,
    goal: input.goal,
    targetAudience: input.targetAudience,
    brandProfile: input.brandProfile,
    locale: input.locale,
    targetPlatforms: input.targetPlatforms,
    startDate: input.startDate,
    endDate: input.endDate,
    status: 'DRAFT',
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  store.campaigns.set(campaign.id, campaign)
  recordMarketingStudioUsage(store, {
    customerAccountId: input.customerAccountId,
    managedSiteId: input.managedSiteId,
    operation: 'draft',
    source: 'campaign.create',
    idempotencyKey: `draft:${campaign.id}`,
  })
  return { ok: true, value: campaign }
}

export function addSocialCampaignRevision(
  store: SocialStore,
  input: {
    campaignId: string
    customerAccountId: string
    captionEn: string
    captionEs?: string
    mediaRefs?: string[]
    platformPayloads?: Record<string, unknown>
    targetChannelIds: string[]
    scheduledAt?: Date
  },
): SocialResult<SocialCampaignRevisionRecord> {
  const campaign = store.campaigns.get(input.campaignId)
  if (!campaign || campaign.customerAccountId !== input.customerAccountId) {
    return { ok: false, code: 'NOT_FOUND', message: 'Campaign not found' }
  }
  const prior = [...store.revisions.values()].filter((r) => r.campaignId === campaign.id)
  const revisionNumber = prior.length + 1
  const contentHash = stableSocialContentHash({
    captionEn: input.captionEn,
    captionEs: input.captionEs,
    mediaRefs: input.mediaRefs ?? [],
    platformPayloads: input.platformPayloads ?? {},
    targetChannelIds: input.targetChannelIds,
    scheduledAt: input.scheduledAt?.toISOString(),
  })
  const revision: SocialCampaignRevisionRecord = {
    id: nextSocialId('socrev'),
    campaignId: campaign.id,
    revisionNumber,
    contentHash,
    captionEn: input.captionEn,
    captionEs: input.captionEs,
    mediaRefs: input.mediaRefs ?? [],
    platformPayloads: input.platformPayloads ?? {},
    targetChannelIds: input.targetChannelIds,
    scheduledAt: input.scheduledAt,
    createdAt: new Date(),
  }
  store.revisions.set(revision.id, revision)
  campaign.activeRevisionId = revision.id
  campaign.status = 'DRAFT'
  campaign.approvedRevisionId = undefined
  campaign.updatedAt = new Date()
  return { ok: true, value: revision }
}

export function submitSocialCampaignForApproval(
  store: SocialStore,
  campaignId: string,
  customerAccountId: string,
): SocialResult<SocialCampaignRecord> {
  const campaign = store.campaigns.get(campaignId)
  if (!campaign || campaign.customerAccountId !== customerAccountId) {
    return { ok: false, code: 'NOT_FOUND', message: 'Campaign not found' }
  }
  if (!campaign.activeRevisionId) {
    return { ok: false, code: 'NO_REVISION', message: 'Campaign requires a revision before approval' }
  }
  return transitionSocialCampaign(store, campaignId, customerAccountId, 'AWAITING_APPROVAL')
}

export function transitionSocialCampaign(
  store: SocialStore,
  campaignId: string,
  customerAccountId: string,
  to: SocialCampaignStatus,
): SocialResult<SocialCampaignRecord> {
  const campaign = store.campaigns.get(campaignId)
  if (!campaign || campaign.customerAccountId !== customerAccountId) {
    return { ok: false, code: 'NOT_FOUND', message: 'Campaign not found' }
  }
  const gate = assertSocialCampaignTransition(campaign.status, to)
  if (!gate.ok) return gate
  campaign.status = to
  campaign.updatedAt = new Date()
  return { ok: true, value: campaign }
}

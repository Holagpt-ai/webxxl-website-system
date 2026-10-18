import type { SocialStore } from '@/lib/platform/social/in-memory-store'
import { listConnectionsForAccount } from '@/lib/platform/social/connections-service'
import {
  addSocialCampaignRevision,
  createSocialCampaign,
  submitSocialCampaignForApproval,
} from '@/lib/platform/social/campaign-service'
import {
  createSocialCampaignApproval,
  decideSocialCampaignApproval,
} from '@/lib/platform/social/approval-service'
import { buildAccountMarketingCalendar } from '@/lib/platform/social/calendar-service'
import { scheduleApprovedSocialCampaign } from '@/lib/platform/social/scheduling-gateway'
import type { PostizSocialPublisher } from '@/lib/platform/providers/postiz-social'
import type { TrustedSocialApprover } from '@/lib/platform/social/operator-auth'
import type { SocialPlatformKey } from '@/lib/platform/social/types'

export type SocialApiActor = {
  userId: string
  customerAccountId: string
  managedSiteId?: string
}

export function handleListConnections(store: SocialStore, actor: SocialApiActor) {
  if (actor.customerAccountId !== actor.customerAccountId) {
    return { ok: false as const, code: 'UNAUTHORIZED', message: 'Invalid account context' }
  }
  return {
    ok: true as const,
    value: listConnectionsForAccount(store, actor.customerAccountId, actor.managedSiteId),
  }
}

export function handleCreateCampaign(
  store: SocialStore,
  actor: SocialApiActor,
  body: {
    goal: string
    locale: 'en' | 'es'
    targetPlatforms: SocialPlatformKey[]
    targetAudience?: string
    brandProfile?: string
  },
) {
  return createSocialCampaign(store, {
    customerAccountId: actor.customerAccountId,
    managedSiteId: actor.managedSiteId,
    createdByUserId: actor.userId,
    goal: body.goal,
    locale: body.locale,
    targetPlatforms: body.targetPlatforms,
    targetAudience: body.targetAudience,
    brandProfile: body.brandProfile,
  })
}

export function handleCreateRevision(
  store: SocialStore,
  actor: SocialApiActor,
  campaignId: string,
  body: {
    captionEn: string
    captionEs?: string
    targetChannelIds: string[]
    scheduledAt?: string
  },
) {
  return addSocialCampaignRevision(store, {
    campaignId,
    customerAccountId: actor.customerAccountId,
    captionEn: body.captionEn,
    captionEs: body.captionEs,
    targetChannelIds: body.targetChannelIds,
    scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : undefined,
  })
}

export function handleApproveCampaign(
  store: SocialStore,
  actor: SocialApiActor,
  campaignId: string,
  trustedApprover: TrustedSocialApprover,
  approvalId: string,
) {
  const campaign = store.campaigns.get(campaignId)
  if (!campaign || campaign.customerAccountId !== actor.customerAccountId) {
    return { ok: false as const, code: 'NOT_FOUND', message: 'Campaign not found' }
  }
  return decideSocialCampaignApproval(store, {
    approvalId,
    trustedApprover,
    decision: 'APPROVED',
    approvedScope: { campaignId, accountId: actor.customerAccountId },
  })
}

export function handleSubmitApprovalRequest(store: SocialStore, actor: SocialApiActor, campaignId: string) {
  const submitted = submitSocialCampaignForApproval(store, campaignId, actor.customerAccountId)
  if (!submitted.ok) return submitted
  const revision = submitted.value.activeRevisionId
    ? store.revisions.get(submitted.value.activeRevisionId)
    : undefined
  if (!revision) return { ok: false as const, code: 'NO_REVISION', message: 'Missing revision' }
  const approval = createSocialCampaignApproval(store, {
    campaignId,
    revisionId: revision.id,
    contentHash: revision.contentHash,
    expiresAt: new Date(Date.now() + 7 * 24 * 3600_000),
  })
  return { ok: true as const, value: { campaign: submitted.value, approval } }
}

export async function handleScheduleCampaign(
  store: SocialStore,
  publisher: PostizSocialPublisher,
  actor: SocialApiActor,
  campaignId: string,
  body: { channelId: string; approvalId: string; idempotencyKey: string; scheduledAt: string },
) {
  return scheduleApprovedSocialCampaign(store, publisher, {
    campaignId,
    customerAccountId: actor.customerAccountId,
    actorUserId: actor.userId,
    channelId: body.channelId,
    approvalId: body.approvalId,
    idempotencyKey: body.idempotencyKey,
    scheduledAt: new Date(body.scheduledAt),
  })
}

export function handleGetCalendar(store: SocialStore, actor: SocialApiActor, from: Date, to: Date) {
  return {
    ok: true as const,
    value: buildAccountMarketingCalendar(store, actor.customerAccountId, from, to),
  }
}

export function handleListPublications(store: SocialStore, actor: SocialApiActor) {
  const pubs = [...store.publications.values()].filter((p) => p.customerAccountId === actor.customerAccountId)
  return { ok: true as const, value: pubs }
}

export function handleListCampaigns(store: SocialStore, actor: SocialApiActor) {
  const campaigns = [...store.campaigns.values()].filter((c) => c.customerAccountId === actor.customerAccountId)
  return { ok: true as const, value: campaigns }
}

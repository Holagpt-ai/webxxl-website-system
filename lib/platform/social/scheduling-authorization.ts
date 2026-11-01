import { isSocialMarketingEnabled } from '@/config/social-marketing'
import { verifySocialApprovalForScheduling } from '@/lib/platform/social/approval-service'
import { assertPostizExternalIntegrationForSchedule } from '@/lib/platform/social/connections-postiz'
import {
  assertChannelDispatchAllowed,
  denyBillingGroupSiblingAccess,
  getConnectionForAccount,
} from '@/lib/platform/social/connections-service'
import type { SocialStore } from '@/lib/platform/social/in-memory-store'
import { assertWithinQuota } from '@/lib/platform/social/quota-service'
import { computeSchedulingRequestFingerprint } from '@/lib/platform/social/scheduling-fingerprint'
import type {
  BusinessSocialConnectionRecord,
  SocialCampaignRecord,
  SocialCampaignRevisionRecord,
  SocialResult,
} from '@/lib/platform/social/types'

export type SocialSchedulingAuthorizationInput = {
  campaignId: string
  customerAccountId: string
  actorUserId: string
  channelId: string
  approvalId: string
  scheduledAt: Date
}

export type SocialSchedulingAuthorizationContext = {
  campaign: SocialCampaignRecord
  revision: SocialCampaignRevisionRecord
  connection: BusinessSocialConnectionRecord
  requestFingerprint: string
}

export function authorizeSocialSchedulingRequest(
  store: SocialStore,
  input: SocialSchedulingAuthorizationInput,
): SocialResult<SocialSchedulingAuthorizationContext> {
  if (!isSocialMarketingEnabled()) {
    return { ok: false, code: 'SOCIAL_MARKETING_DISABLED', message: 'Marketing Studio disabled' }
  }

  const campaign = store.campaigns.get(input.campaignId)
  if (!campaign || campaign.customerAccountId !== input.customerAccountId) {
    return { ok: false, code: 'NOT_FOUND', message: 'Campaign not found' }
  }
  const revision = campaign.approvedRevisionId
    ? store.revisions.get(campaign.approvedRevisionId)
    : undefined
  if (!revision) {
    return { ok: false, code: 'NO_APPROVED_REVISION', message: 'Missing approved revision' }
  }

  const requestFingerprint = computeSchedulingRequestFingerprint({
    customerAccountId: input.customerAccountId,
    campaignId: campaign.id,
    revisionId: revision.id,
    approvalId: input.approvalId,
    channelId: input.channelId,
    scheduledAt: input.scheduledAt,
    contentHash: revision.contentHash,
  })

  if (campaign.status !== 'APPROVED' && campaign.status !== 'SCHEDULING') {
    return { ok: false, code: 'INVALID_STATE', message: 'Campaign must be approved before scheduling' }
  }
  if (!revision.targetChannelIds.includes(input.channelId)) {
    return { ok: false, code: 'CHANNEL_NOT_IN_SCOPE', message: 'Channel not in approved revision' }
  }
  if (revision.scheduledAt && revision.scheduledAt.getTime() !== input.scheduledAt.getTime()) {
    return { ok: false, code: 'SCHEDULE_TIME_MISMATCH', message: 'Scheduled time outside approved scope' }
  }

  const approvalCheck = verifySocialApprovalForScheduling(store, {
    approvalId: input.approvalId,
    campaignId: campaign.id,
    revisionId: revision.id,
    contentHash: revision.contentHash,
    consumeUse: false,
  })
  if (!approvalCheck.ok) return approvalCheck

  const connectionGate = getConnectionForAccount(store, input.channelId, input.customerAccountId)
  if (!connectionGate.ok) return connectionGate
  const siblingGate = denyBillingGroupSiblingAccess(
    store,
    input.actorUserId,
    input.customerAccountId,
    connectionGate.value.customerAccountId,
  )
  if (!siblingGate.ok) return siblingGate
  const channelGate = assertChannelDispatchAllowed(connectionGate.value)
  if (!channelGate.ok) return channelGate

  const postizBoundary = assertPostizExternalIntegrationForSchedule(
    store,
    input.customerAccountId,
    connectionGate.value.externalChannelRef,
  )
  if (!postizBoundary.ok) return postizBoundary

  const quota = assertWithinQuota(store, input.customerAccountId, 'schedule')
  if (!quota.ok) return quota

  return {
    ok: true,
    value: { campaign, revision, connection: connectionGate.value, requestFingerprint },
  }
}

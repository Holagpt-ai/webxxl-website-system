import { isSocialMarketingEnabled, marketingStudioDefaultPeriodKey, marketingStudioQuotaPolicy } from '@/config/social-marketing'
import { prisma } from '@/lib/db'
import { verifySocialApprovalForSchedulingPrisma } from '@/lib/platform/social/approval-persist-service'
import { assertPostizExternalIntegrationForSchedulePrisma } from '@/lib/platform/social/postiz-isolation-prisma'
import { computeSchedulingRequestFingerprint } from '@/lib/platform/social/scheduling-fingerprint'
import type { SocialResult } from '@/lib/platform/social/types'

function parseTargetChannelIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((row): row is string => typeof row === 'string')
}

export type SocialSchedulingAuthorizationPrismaInput = {
  campaignId: string
  customerAccountId: string
  actorUserId: string
  channelId: string
  approvalId: string
  scheduledAt: Date
}

export async function authorizeSocialSchedulingRequestPrisma(
  input: SocialSchedulingAuthorizationPrismaInput,
): Promise<
  SocialResult<{
    requestFingerprint: string
    revisionId: string
    contentHash: string
    externalChannelRef: string
  }>
> {
  if (!isSocialMarketingEnabled()) {
    return { ok: false, code: 'SOCIAL_MARKETING_DISABLED', message: 'Marketing Studio disabled' }
  }

  const campaign = await prisma.socialCampaign.findFirst({
    where: { id: input.campaignId, customerAccountId: input.customerAccountId },
  })
  if (!campaign) {
    return { ok: false, code: 'NOT_FOUND', message: 'Campaign not found' }
  }
  if (!campaign.approvedRevisionId) {
    return { ok: false, code: 'NO_APPROVED_REVISION', message: 'Missing approved revision' }
  }

  const revision = await prisma.socialCampaignRevision.findFirst({
    where: { id: campaign.approvedRevisionId, campaignId: campaign.id },
  })
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

  const targetChannelIds = parseTargetChannelIds(revision.targetChannelIds)
  if (!targetChannelIds.includes(input.channelId)) {
    return { ok: false, code: 'CHANNEL_NOT_IN_SCOPE', message: 'Channel not in approved revision' }
  }
  if (revision.scheduledAt && revision.scheduledAt.getTime() !== input.scheduledAt.getTime()) {
    return { ok: false, code: 'SCHEDULE_TIME_MISMATCH', message: 'Scheduled time outside approved scope' }
  }

  const approvalCheck = await verifySocialApprovalForSchedulingPrisma({
    approvalId: input.approvalId,
    campaignId: campaign.id,
    revisionId: revision.id,
    contentHash: revision.contentHash,
    consumeUse: false,
  })
  if (!approvalCheck.ok) return approvalCheck

  const connection = await prisma.businessSocialConnection.findFirst({
    where: { id: input.channelId, customerAccountId: input.customerAccountId },
  })
  if (!connection) {
    return { ok: false, code: 'NOT_FOUND', message: 'Social connection not found' }
  }
  if (connection.connectionState === 'REVOKED' || connection.connectionState === 'EXPIRED') {
    return { ok: false, code: 'CHANNEL_REVOKED', message: 'Social channel is revoked or expired' }
  }
  if (connection.connectionState !== 'CONNECTED') {
    return { ok: false, code: 'CHANNEL_NOT_CONNECTED', message: 'Social channel is not connected' }
  }

  const postizBoundary = await assertPostizExternalIntegrationForSchedulePrisma(
    input.customerAccountId,
    connection.externalChannelRef,
  )
  if (!postizBoundary.ok) return postizBoundary

  const periodKey = marketingStudioDefaultPeriodKey()
  const policy = marketingStudioQuotaPolicy()
  const used = await prisma.marketingStudioUsage.aggregate({
    where: {
      customerAccountId: input.customerAccountId,
      periodKey,
      operation: 'schedule',
    },
    _sum: { units: true },
  })
  const usedUnits = used._sum.units ?? 0
  if (usedUnits >= policy.schedulingRequestsPerAccountMonth) {
    return { ok: false, code: 'QUOTA_EXCEEDED', message: 'FREE Marketing Studio schedule quota exceeded' }
  }

  return {
    ok: true,
    value: {
      requestFingerprint,
      revisionId: revision.id,
      contentHash: revision.contentHash,
      externalChannelRef: connection.externalChannelRef,
    },
  }
}
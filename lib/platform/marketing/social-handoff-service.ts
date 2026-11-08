import { prisma } from '@/lib/db'
import { isPostizLivePublishingEnabled, isSocialMarketingEnabled } from '@/config/social-marketing'
import { isMktExternalHandoffEnabled } from '@/config/mkt-backend'
import { computeReviewEffectiveStatus } from '@/lib/platform/marketing/review-presentation'
import type { MktResult } from '@/lib/platform/marketing/types'

export type SocialHandoffPrepared = {
  handoffState: 'PREPARED' | 'BLOCKED'
  schedulingAllowed: false
  marketingArtifactId?: string
  revisionHash?: string
  allowedChannel?: string | null
}

/** Policy probe used by legacy tests — does not load persistence. */
export function prepareSocialHandoffFromApprovedCreative(input: {
  revisionHash: string
  approved: boolean
  channel?: string
}): MktResult<SocialHandoffPrepared> {
  if (!isMktExternalHandoffEnabled() || !isSocialMarketingEnabled()) {
    return {
      ok: true,
      value: { handoffState: 'BLOCKED', schedulingAllowed: false },
    }
  }
  if (!input.approved) {
    return { ok: false, code: 'FORBIDDEN', message: 'Social handoff requires approved revision' }
  }
  if (isPostizLivePublishingEnabled()) {
    return { ok: false, code: 'NOT_CONFIGURED', message: 'Live Postiz publishing remains disabled in MKT-08' }
  }
  return {
    ok: true,
    value: {
      handoffState: 'PREPARED',
      schedulingAllowed: false,
      revisionHash: input.revisionHash,
      allowedChannel: input.channel ?? null,
    },
  }
}

/**
 * Account-scoped creative → social preparation handoff.
 * Validates immutable approved review + revision hash; never schedules Postiz.
 */
export async function prepareApprovedCreativeSocialHandoff(input: {
  customerAccountId: string
  marketingArtifactId: string
  revisionHash: string
  managedSiteId?: string | null
  allowedChannel?: string | null
}): Promise<MktResult<SocialHandoffPrepared>> {
  if (!isMktExternalHandoffEnabled() || !isSocialMarketingEnabled()) {
    return {
      ok: true,
      value: { handoffState: 'BLOCKED', schedulingAllowed: false },
    }
  }
  if (isPostizLivePublishingEnabled()) {
    return { ok: false, code: 'NOT_CONFIGURED', message: 'Live Postiz publishing remains disabled in MKT-08' }
  }

  const artifact = await prisma.marketingArtifact.findFirst({
    where: {
      id: input.marketingArtifactId,
      customerAccountId: input.customerAccountId,
      ...(input.managedSiteId ? { managedSiteId: input.managedSiteId } : {}),
    },
    select: {
      id: true,
      revisionHash: true,
      artifactType: true,
      managedSiteId: true,
    },
  })
  if (!artifact) {
    return { ok: false, code: 'NOT_FOUND', message: 'Marketing artifact not found' }
  }
  if (artifact.revisionHash !== input.revisionHash) {
    return { ok: false, code: 'VALIDATION', message: 'Revision hash does not match artifact' }
  }
  if (artifact.artifactType !== 'SOCIAL_CAMPAIGN' && artifact.artifactType !== 'SOCIAL_POST') {
    return { ok: false, code: 'VALIDATION', message: 'Artifact is not a social deliverable type' }
  }

  const review = await prisma.marketingArtifactReview.findFirst({
    where: {
      customerAccountId: input.customerAccountId,
      marketingArtifactId: artifact.id,
      revisionHash: input.revisionHash,
    },
    orderBy: { createdAt: 'desc' },
    select: {
      status: true,
      expiresAt: true,
      revokedAt: true,
      allowedChannel: true,
    },
  })
  if (!review) {
    return { ok: false, code: 'NOT_FOUND', message: 'No review record for artifact revision' }
  }

  const effective = computeReviewEffectiveStatus(review)
  if (effective !== 'APPROVED') {
    return {
      ok: false,
      code: 'FORBIDDEN',
      message: `Social handoff requires APPROVED review (effective: ${effective})`,
    }
  }

  if (input.allowedChannel && review.allowedChannel && input.allowedChannel !== review.allowedChannel) {
    return {
      ok: false,
      code: 'FORBIDDEN',
      message: 'Requested channel is outside approval scope',
    }
  }

  return {
    ok: true,
    value: {
      handoffState: 'PREPARED',
      schedulingAllowed: false,
      marketingArtifactId: artifact.id,
      revisionHash: artifact.revisionHash,
      allowedChannel: review.allowedChannel ?? input.allowedChannel ?? null,
    },
  }
}

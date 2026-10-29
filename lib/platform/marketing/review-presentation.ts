import type { MarketingArtifactReviewStatus } from '@prisma/client'

export type ReviewRecordTiming = {
  status: MarketingArtifactReviewStatus
  expiresAt: Date | null
  revokedAt: Date | null
}

export type ReviewEffectiveStatus =
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'REVOKED'
  | 'EXPIRED'
  | 'DRAFT'

export function computeReviewEffectiveStatus(
  review: ReviewRecordTiming,
  now: Date = new Date(),
): ReviewEffectiveStatus {
  if (review.revokedAt || review.status === 'REVOKED') return 'REVOKED'
  if (review.status === 'APPROVED') return 'APPROVED'
  if (review.status === 'REJECTED') return 'REJECTED'
  if (review.status === 'EXPIRED') return 'EXPIRED'
  if (review.status === 'DRAFT') return 'DRAFT'
  if (review.status === 'SUBMITTED') {
    if (review.expiresAt && review.expiresAt.getTime() < now.getTime()) return 'EXPIRED'
    return 'SUBMITTED'
  }
  return 'DRAFT'
}

export function isActiveSubmittedReview(review: ReviewRecordTiming, now: Date = new Date()): boolean {
  return computeReviewEffectiveStatus(review, now) === 'SUBMITTED'
}

export function reviewAllowedActions(input: {
  review: ReviewRecordTiming & {
    intendedAction: string
    allowedChannel?: string | null
    allowedTarget?: string | null
  }
  viewerCanDecide: boolean
  now?: Date
}): {
  canDecide: boolean
  intendedAction: string
  allowedChannel?: string | null
  allowedTarget?: string | null
} {
  const effective = computeReviewEffectiveStatus(input.review, input.now)
  return {
    canDecide: input.viewerCanDecide && effective === 'SUBMITTED',
    intendedAction: input.review.intendedAction,
    allowedChannel: input.review.allowedChannel ?? null,
    allowedTarget: input.review.allowedTarget ?? null,
  }
}

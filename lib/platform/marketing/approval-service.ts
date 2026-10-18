import { isMktApprovalWorkflowEnabled } from '@/config/mkt-backend'
import { prisma } from '@/lib/db'
import type { MktResult } from '@/lib/platform/marketing/types'

export const MKT_APPROVAL_POLICY_VERSION = 'mkt-08-v1'

export async function submitMarketingArtifactReview(input: {
  customerAccountId: string
  userId: string
  artifactId: string
  revisionHash: string
  intendedAction: string
  allowedChannel?: string
  allowedTarget?: string
}): Promise<MktResult<{ reviewId: string }>> {
  if (!isMktApprovalWorkflowEnabled()) {
    return { ok: false, code: 'NOT_CONFIGURED', message: 'Marketing approval workflow disabled' }
  }
  const artifact = await prisma.marketingArtifact.findFirst({
    where: { id: input.artifactId, customerAccountId: input.customerAccountId },
  })
  if (!artifact) return { ok: false, code: 'NOT_FOUND', message: 'Artifact not found' }
  if (artifact.revisionHash !== input.revisionHash) {
    return { ok: false, code: 'CONFLICT', message: 'Revision hash mismatch — submit the current revision' }
  }
  const latestRevision = await prisma.marketingArtifactRevision.findFirst({
    where: { marketingArtifactId: artifact.id, revisionHash: input.revisionHash },
  })
  if (!latestRevision) return { ok: false, code: 'VALIDATION', message: 'Unknown revision hash' }
  if (!artifact.marketingRequestId) return { ok: false, code: 'VALIDATION', message: 'Artifact missing request link' }

  const review = await prisma.marketingArtifactReview.create({
    data: {
      customerAccountId: input.customerAccountId,
      managedSiteId: artifact.managedSiteId,
      marketingRequestId: artifact.marketingRequestId,
      marketingArtifactId: artifact.id,
      revisionHash: input.revisionHash,
      intendedAction: input.intendedAction,
      allowedChannel: input.allowedChannel,
      allowedTarget: input.allowedTarget,
      status: 'SUBMITTED',
      policyVersion: MKT_APPROVAL_POLICY_VERSION,
      expiresAt: new Date(Date.now() + 7 * 86400000),
    },
  })
  await prisma.marketingArtifact.update({
    where: { id: artifact.id },
    data: { reviewStatus: 'SUBMITTED' },
  })
  return { ok: true, value: { reviewId: review.id } }
}

export async function decideMarketingArtifactReview(input: {
  customerAccountId: string
  reviewerUserId: string
  reviewId: string
  decision: 'APPROVED' | 'REJECTED'
  actorType: 'USER' | 'AGENT'
}): Promise<MktResult<true>> {
  if (!isMktApprovalWorkflowEnabled()) {
    return { ok: false, code: 'NOT_CONFIGURED', message: 'Marketing approval workflow disabled' }
  }
  if (input.actorType === 'AGENT') {
    return { ok: false, code: 'FORBIDDEN', message: 'Agent cannot approve its own deliverable' }
  }

  return prisma.$transaction(async (tx) => {
    const review = await tx.marketingArtifactReview.findFirst({
      where: { id: input.reviewId, customerAccountId: input.customerAccountId },
    })
    if (!review) return { ok: false, code: 'NOT_FOUND', message: 'Review not found' }
    if (review.status !== 'SUBMITTED') return { ok: false, code: 'CONFLICT', message: 'Review not pending' }
    if (review.revokedAt) return { ok: false, code: 'FORBIDDEN', message: 'Review revoked' }
    if (review.expiresAt && review.expiresAt.getTime() < Date.now()) {
      return { ok: false, code: 'FORBIDDEN', message: 'Review expired' }
    }
    if (review.policyVersion !== MKT_APPROVAL_POLICY_VERSION) {
      return { ok: false, code: 'FORBIDDEN', message: 'Review policy version mismatch' }
    }

    const artifact = await tx.marketingArtifact.findFirst({
      where: { id: review.marketingArtifactId, customerAccountId: input.customerAccountId },
    })
    if (!artifact || artifact.revisionHash !== review.revisionHash) {
      return { ok: false, code: 'FORBIDDEN', message: 'Approval does not match current artifact revision' }
    }

    const reviewUpdated = await tx.marketingArtifactReview.updateMany({
      where: {
        id: review.id,
        customerAccountId: input.customerAccountId,
        status: 'SUBMITTED',
      },
      data: {
        status: input.decision,
        approverUserId: input.reviewerUserId,
        decidedAt: new Date(),
      },
    })
    if (reviewUpdated.count !== 1) {
      return { ok: false, code: 'CONFLICT', message: 'Review already decided concurrently' }
    }

    const artifactUpdated = await tx.marketingArtifact.updateMany({
      where: {
        id: artifact.id,
        customerAccountId: input.customerAccountId,
        revisionHash: review.revisionHash,
      },
      data: { reviewStatus: input.decision },
    })
    if (artifactUpdated.count !== 1) {
      return { ok: false, code: 'CONFLICT', message: 'Artifact revision changed during approval' }
    }

    return { ok: true, value: true }
  })
}

export function validateReviewForRevision(input: {
  approvedRevisionHash: string
  requestedRevisionHash: string
}): MktResult<true> {
  if (input.approvedRevisionHash !== input.requestedRevisionHash) {
    return { ok: false, code: 'FORBIDDEN', message: 'Approval bound to a different revision' }
  }
  return { ok: true, value: true }
}

export async function revokePendingArtifactReviews(input: {
  customerAccountId: string
  marketingArtifactId: string
}): Promise<void> {
  await prisma.marketingArtifactReview.updateMany({
    where: {
      customerAccountId: input.customerAccountId,
      marketingArtifactId: input.marketingArtifactId,
      status: 'SUBMITTED',
    },
    data: { status: 'REVOKED', revokedAt: new Date() },
  })
}

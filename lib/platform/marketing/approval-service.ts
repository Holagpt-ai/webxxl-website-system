import { isMktApprovalWorkflowEnabled } from '@/config/mkt-backend'
import { prisma } from '@/lib/db'
import type { MktResult } from '@/lib/platform/marketing/types'

export async function submitMarketingArtifactReview(input: {
  customerAccountId: string
  userId: string
  artifactId: string
  revisionHash: string
  intendedAction: string
  allowedChannel?: string
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
      status: 'SUBMITTED',
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
  if (input.actorType === 'AGENT') {
    return { ok: false, code: 'FORBIDDEN', message: 'Agent cannot approve its own deliverable' }
  }
  const review = await prisma.marketingArtifactReview.findFirst({
    where: { id: input.reviewId, customerAccountId: input.customerAccountId },
  })
  if (!review) return { ok: false, code: 'NOT_FOUND', message: 'Review not found' }
  if (review.status !== 'SUBMITTED') return { ok: false, code: 'CONFLICT', message: 'Review not pending' }
  if (review.expiresAt && review.expiresAt.getTime() < Date.now()) {
    return { ok: false, code: 'FORBIDDEN', message: 'Review expired' }
  }
  const artifact = await prisma.marketingArtifact.findUnique({ where: { id: review.marketingArtifactId } })
  if (!artifact || artifact.revisionHash !== review.revisionHash) {
    return { ok: false, code: 'FORBIDDEN', message: 'Approval does not match current artifact revision' }
  }

  await prisma.$transaction([
    prisma.marketingArtifactReview.update({
      where: { id: review.id },
      data: {
        status: input.decision,
        approverUserId: input.reviewerUserId,
        decidedAt: new Date(),
      },
    }),
    prisma.marketingArtifact.update({
      where: { id: artifact.id },
      data: { reviewStatus: input.decision },
    }),
  ])
  return { ok: true, value: true }
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

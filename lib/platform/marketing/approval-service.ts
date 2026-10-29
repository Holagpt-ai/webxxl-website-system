import { isMktApprovalWorkflowEnabled } from '@/config/mkt-backend'
import { prisma } from '@/lib/db'
import type { Prisma } from '@prisma/client'
import {
  ARTIFACT_REVIEW_STATUS_OPEN_FOR_SUBMIT,
  buildActivePendingReviewWhere,
  MKT_APPROVAL_POLICY_VERSION,
} from '@/lib/platform/marketing/approval-pending'
import {
  ApprovalArtifactCasRollbackError,
  ApprovalReviewConcurrentDecisionError,
  ApprovalSubmitArtifactUpdateError,
  ApprovalSubmitDuplicatePendingError,
} from '@/lib/platform/marketing/approval-errors'
import type { MktResult } from '@/lib/platform/marketing/types'

export { MKT_APPROVAL_POLICY_VERSION } from '@/lib/platform/marketing/approval-pending'

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

  try {
    const reviewId = await prisma.$transaction(async (tx) => {
      const head = await tx.marketingArtifact.findFirst({
        where: { id: input.artifactId, customerAccountId: input.customerAccountId },
      })
      if (!head) throw new ApprovalSubmitArtifactUpdateError('Artifact not found')
      if (head.revisionHash !== input.revisionHash) {
        throw new ApprovalSubmitArtifactUpdateError('Revision hash mismatch — submit the current revision')
      }
      const revision = await tx.marketingArtifactRevision.findFirst({
        where: { marketingArtifactId: head.id, revisionHash: input.revisionHash },
      })
      if (!revision) throw new ApprovalSubmitArtifactUpdateError('Unknown revision hash')
      if (!head.marketingRequestId) throw new ApprovalSubmitArtifactUpdateError('Artifact missing request link')

      const now = new Date()
      const activePendingWhere = buildActivePendingReviewWhere({
        customerAccountId: input.customerAccountId,
        marketingArtifactId: head.id,
        revisionHash: input.revisionHash,
        now,
      })

      const artifactOpened = await tx.marketingArtifact.updateMany({
        where: {
          id: head.id,
          customerAccountId: input.customerAccountId,
          revisionHash: input.revisionHash,
          reviewStatus: { in: ARTIFACT_REVIEW_STATUS_OPEN_FOR_SUBMIT },
        },
        data: { reviewStatus: 'SUBMITTED' },
      })

      if (artifactOpened.count !== 1) {
        const active = await tx.marketingArtifactReview.findFirst({ where: activePendingWhere })
        if (active) throw new ApprovalSubmitDuplicatePendingError()
        const fresh = await tx.marketingArtifact.findFirst({
          where: { id: head.id, customerAccountId: input.customerAccountId },
        })
        if (!fresh || fresh.revisionHash !== input.revisionHash) {
          throw new ApprovalSubmitArtifactUpdateError('Revision hash mismatch — submit the current revision')
        }
        if (fresh.reviewStatus === 'SUBMITTED') {
          throw new ApprovalSubmitDuplicatePendingError()
        }
        throw new ApprovalSubmitArtifactUpdateError()
      }

      const review = await tx.marketingArtifactReview.create({
        data: {
          customerAccountId: input.customerAccountId,
          managedSiteId: head.managedSiteId,
          marketingRequestId: head.marketingRequestId,
          marketingArtifactId: head.id,
          revisionHash: input.revisionHash,
          intendedAction: input.intendedAction,
          allowedChannel: input.allowedChannel,
          allowedTarget: input.allowedTarget,
          status: 'SUBMITTED',
          policyVersion: MKT_APPROVAL_POLICY_VERSION,
          expiresAt: new Date(now.getTime() + 7 * 86400000),
        },
      })
      return review.id
    })
    return { ok: true, value: { reviewId } }
  } catch (error) {
    if (error instanceof ApprovalSubmitDuplicatePendingError) {
      return { ok: false, code: 'CONFLICT', message: error.message }
    }
    if (error instanceof ApprovalSubmitArtifactUpdateError) {
      const msg = error.message
      if (msg.includes('not found')) return { ok: false, code: 'NOT_FOUND', message: msg }
      if (msg.includes('missing request') || msg.includes('Unknown revision')) {
        return { ok: false, code: 'VALIDATION', message: msg }
      }
      if (msg.includes('mismatch')) {
        return { ok: false, code: 'CONFLICT', message: msg }
      }
      return { ok: false, code: 'CONFLICT', message: msg }
    }
    throw error
  }
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

  const reviewHead = await prisma.marketingArtifactReview.findFirst({
    where: { id: input.reviewId, customerAccountId: input.customerAccountId },
  })
  if (!reviewHead) return { ok: false, code: 'NOT_FOUND', message: 'Review not found' }

  try {
    await prisma.$transaction(async (tx) => {
      const review = await tx.marketingArtifactReview.findFirst({
        where: { id: input.reviewId, customerAccountId: input.customerAccountId },
      })
      if (!review) throw new ApprovalReviewConcurrentDecisionError('Review not found')
      if (review.status !== 'SUBMITTED') throw new ApprovalReviewConcurrentDecisionError('Review not pending')
      if (review.revokedAt) throw new ApprovalReviewConcurrentDecisionError('Review revoked')
      if (review.expiresAt && review.expiresAt.getTime() < Date.now()) {
        throw new ApprovalReviewConcurrentDecisionError('Review expired')
      }
      if (review.policyVersion !== MKT_APPROVAL_POLICY_VERSION) {
        throw new ApprovalReviewConcurrentDecisionError('Review policy version mismatch')
      }

      const artifact = await tx.marketingArtifact.findFirst({
        where: { id: review.marketingArtifactId, customerAccountId: input.customerAccountId },
      })
      if (!artifact || artifact.revisionHash !== review.revisionHash) {
        throw new ApprovalReviewConcurrentDecisionError('Approval does not match current artifact revision')
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
        throw new ApprovalReviewConcurrentDecisionError()
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
        throw new ApprovalArtifactCasRollbackError()
      }
    })
  } catch (error) {
    if (error instanceof ApprovalArtifactCasRollbackError) {
      return { ok: false, code: 'CONFLICT', message: error.message }
    }
    if (error instanceof ApprovalReviewConcurrentDecisionError) {
      const msg = error.message
      if (msg.includes('expired') || msg.includes('revoked') || msg.includes('match')) {
        return { ok: false, code: 'FORBIDDEN', message: msg }
      }
      return { ok: false, code: 'CONFLICT', message: msg }
    }
    throw error
  }

  const finalized = await prisma.marketingArtifactReview.findFirst({
    where: { id: input.reviewId, customerAccountId: input.customerAccountId },
  })
  if (!finalized) return { ok: false, code: 'NOT_FOUND', message: 'Review not found' }
  if (finalized.status !== input.decision) {
    return { ok: false, code: 'NOT_FOUND', message: 'Review not found' }
  }

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

export async function revokePendingArtifactReviews(input: {
  customerAccountId: string
  marketingArtifactId: string
}): Promise<void> {
  await revokePendingArtifactReviewsInTransaction(prisma, input)
}

export async function revokePendingArtifactReviewsInTransaction(
  tx: Prisma.TransactionClient,
  input: { customerAccountId: string; marketingArtifactId: string },
): Promise<void> {
  await tx.marketingArtifactReview.updateMany({
    where: {
      customerAccountId: input.customerAccountId,
      marketingArtifactId: input.marketingArtifactId,
      status: 'SUBMITTED',
    },
    data: { status: 'REVOKED', revokedAt: new Date() },
  })
}

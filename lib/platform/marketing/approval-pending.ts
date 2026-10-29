import type { MarketingArtifactReviewStatus, Prisma } from '@prisma/client'

export const MKT_APPROVAL_POLICY_VERSION = 'mkt-08-v1'

/** Artifact reviewStatus values that may transition into a new submission. */
export const ARTIFACT_REVIEW_STATUS_OPEN_FOR_SUBMIT: MarketingArtifactReviewStatus[] = [
  'DRAFT',
  'REJECTED',
  'APPROVED',
  'EXPIRED',
  'REVOKED',
]

export function buildActivePendingReviewWhere(input: {
  customerAccountId: string
  marketingArtifactId: string
  revisionHash: string
  now?: Date
}): Prisma.MarketingArtifactReviewWhereInput {
  const now = input.now ?? new Date()
  return {
    customerAccountId: input.customerAccountId,
    marketingArtifactId: input.marketingArtifactId,
    revisionHash: input.revisionHash,
    status: 'SUBMITTED',
    revokedAt: null,
    policyVersion: MKT_APPROVAL_POLICY_VERSION,
    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
  }
}

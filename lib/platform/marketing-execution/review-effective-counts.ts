import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import type { ReviewEffectiveStatus } from '@/lib/platform/marketing/review-presentation'

const REVOKED_FIRST: ReviewEffectiveStatus[] = [
  'REVOKED',
  'APPROVED',
  'REJECTED',
  'EXPIRED',
  'SUBMITTED',
  'DRAFT',
]

const notRevokedClause = (): Prisma.MarketingArtifactReviewWhereInput => ({
  revokedAt: null,
  NOT: { status: 'REVOKED' },
})

/** Mutually exclusive Prisma filters aligned with `computeReviewEffectiveStatus` (revocation first). */
export function reviewEffectiveStatusWhere(
  effective: ReviewEffectiveStatus,
  baseWhere: Prisma.MarketingArtifactReviewWhereInput,
  now: Date,
): Prisma.MarketingArtifactReviewWhereInput {
  switch (effective) {
    case 'REVOKED':
      return {
        AND: [baseWhere, { OR: [{ status: 'REVOKED' }, { revokedAt: { not: null } }] }],
      }
    case 'APPROVED':
      return { AND: [baseWhere, notRevokedClause(), { status: 'APPROVED' }] }
    case 'REJECTED':
      return { AND: [baseWhere, notRevokedClause(), { status: 'REJECTED' }] }
    case 'EXPIRED':
      return {
        AND: [
          baseWhere,
          notRevokedClause(),
          {
            OR: [
              { status: 'EXPIRED' },
              { status: 'SUBMITTED', expiresAt: { lt: now } },
            ],
          },
        ],
      }
    case 'SUBMITTED':
      return {
        AND: [
          baseWhere,
          notRevokedClause(),
          { status: 'SUBMITTED' },
          { OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] },
        ],
      }
    case 'DRAFT':
      return { AND: [baseWhere, notRevokedClause(), { status: 'DRAFT' }] }
    default:
      return { AND: [baseWhere, notRevokedClause(), { status: 'DRAFT' }] }
  }
}

export async function countReviewEffectiveStatuses(
  baseWhere: Prisma.MarketingArtifactReviewWhereInput,
  now: Date,
): Promise<Record<ReviewEffectiveStatus, number>> {
  const entries = await Promise.all(
    REVOKED_FIRST.map(async (effective) => {
      const count = await prisma.marketingArtifactReview.count({
        where: reviewEffectiveStatusWhere(effective, baseWhere, now),
      })
      return [effective, count] as const
    }),
  )
  return Object.fromEntries(entries) as Record<ReviewEffectiveStatus, number>
}

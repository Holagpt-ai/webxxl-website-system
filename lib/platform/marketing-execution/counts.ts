import { prisma } from '@/lib/db'
import { computeReviewEffectiveStatus } from '@/lib/platform/marketing/review-presentation'
import type { MarketingWorkflowLifecycleCounts } from '@/lib/platform/marketing-execution/types'

const REVIEW_EVIDENCE_TAKE = 25

function scopeWhere(customerAccountId: string, managedSiteId?: string | null) {
  return {
    customerAccountId,
    ...(managedSiteId ? { managedSiteId } : {}),
  }
}

export async function loadMarketingWorkflowLifecycleCounts(input: {
  customerAccountId: string
  managedSiteId?: string | null
  now: Date
}): Promise<MarketingWorkflowLifecycleCounts> {
  const where = scopeWhere(input.customerAccountId, input.managedSiteId)

  const [requestGroups, reviewRows, publicationGroups] = await Promise.all([
    prisma.marketingRequest.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
    }),
    prisma.marketingArtifactReview.findMany({
      where,
      select: {
        status: true,
        expiresAt: true,
        revokedAt: true,
      },
    }),
    prisma.socialPublication.groupBy({
      by: ['status'],
      where: { customerAccountId: input.customerAccountId },
      _count: { _all: true },
    }),
  ])

  const requestStatus: Record<string, number> = {}
  for (const row of requestGroups) {
    requestStatus[row.status] = row._count._all
  }

  const reviewEffectiveStatus: Record<string, number> = {}
  for (const row of reviewRows) {
    const effective = computeReviewEffectiveStatus(row, input.now)
    reviewEffectiveStatus[effective] = (reviewEffectiveStatus[effective] ?? 0) + 1
  }

  const publicationStatus: Record<string, number> = {}
  for (const row of publicationGroups) {
    publicationStatus[row.status] = row._count._all
  }

  const draft =
    (requestStatus.DRAFT ?? 0) +
    (reviewEffectiveStatus.DRAFT ?? 0)
  const submitted = reviewEffectiveStatus.SUBMITTED ?? 0
  const approved = reviewEffectiveStatus.APPROVED ?? 0
  const prepared = requestStatus.HANDED_OFF ?? 0
  const scheduled =
    (publicationStatus.SCHEDULED ?? 0) +
    (publicationStatus.PENDING ?? 0)
  const publishedWithProof = await prisma.socialPublication.count({
    where: {
      customerAccountId: input.customerAccountId,
      status: 'PUBLISHED',
      publishedUrl: { not: null },
    },
  })
  const reconciliationRequired = publicationStatus.RECONCILIATION_REQUIRED ?? 0

  return {
    requestStatus,
    reviewEffectiveStatus,
    publicationStatus,
    executionLadder: {
      DRAFT: draft,
      SUBMITTED: submitted,
      APPROVED: approved,
      PREPARED: prepared,
      SCHEDULED: scheduled,
      PUBLISHED: publishedWithProof,
      RECONCILIATION_REQUIRED: reconciliationRequired,
    },
  }
}

export async function loadMarketingReviewEvidence(input: {
  customerAccountId: string
  managedSiteId?: string | null
  now: Date
}) {
  const rows = await prisma.marketingArtifactReview.findMany({
    where: scopeWhere(input.customerAccountId, input.managedSiteId),
    orderBy: [{ decidedAt: 'desc' }, { createdAt: 'desc' }],
    take: REVIEW_EVIDENCE_TAKE + 1,
    select: {
      id: true,
      marketingRequestId: true,
      marketingArtifactId: true,
      managedSiteId: true,
      revisionHash: true,
      status: true,
      expiresAt: true,
      decidedAt: true,
      revokedAt: true,
      allowedChannel: true,
    },
  })

  const truncated = rows.length > REVIEW_EVIDENCE_TAKE
  const items = rows.slice(0, REVIEW_EVIDENCE_TAKE).map((row) => ({
    reviewId: row.id,
    marketingRequestId: row.marketingRequestId,
    marketingArtifactId: row.marketingArtifactId,
    managedSiteId: row.managedSiteId,
    effectiveStatus: computeReviewEffectiveStatus(row, input.now),
    revisionHash: row.revisionHash,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    decidedAt: row.decidedAt?.toISOString() ?? null,
    revokedAt: row.revokedAt?.toISOString() ?? null,
    allowedChannel: row.allowedChannel,
  }))

  return { items, truncated }
}

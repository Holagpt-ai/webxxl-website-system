import { prisma } from '@/lib/db'
import { computeReviewEffectiveStatus } from '@/lib/platform/marketing/review-presentation'
import { countReviewEffectiveStatuses } from '@/lib/platform/marketing-execution/review-effective-counts'
import type { MarketingWorkflowLifecycleCounts } from '@/lib/platform/marketing-execution/types'

const REVIEW_EVIDENCE_TAKE = 25

function scopeWhere(customerAccountId: string, managedSiteId?: string | null) {
  return {
    customerAccountId,
    ...(managedSiteId ? { managedSiteId } : {}),
  }
}

function publicationScopeWhere(customerAccountId: string, managedSiteId?: string | null) {
  return {
    customerAccountId,
    ...(managedSiteId ? { campaign: { managedSiteId } } : {}),
  }
}

export async function loadMarketingWorkflowLifecycleCounts(input: {
  customerAccountId: string
  managedSiteId?: string | null
  now: Date
}): Promise<MarketingWorkflowLifecycleCounts> {
  const where = scopeWhere(input.customerAccountId, input.managedSiteId)
  const publicationWhere = publicationScopeWhere(input.customerAccountId, input.managedSiteId)

  const [requestGroups, reviewEffectiveStatus, publicationGroups, publishedWithProof] = await Promise.all([
    prisma.marketingRequest.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
    }),
    countReviewEffectiveStatuses(where, input.now),
    prisma.socialPublication.groupBy({
      by: ['status'],
      where: publicationWhere,
      _count: { _all: true },
    }),
    prisma.socialPublication.count({
      where: {
        ...publicationWhere,
        status: 'PUBLISHED',
        publishedUrl: { not: null },
      },
    }),
  ])

  const requestStatus: Record<string, number> = {}
  for (const row of requestGroups) {
    requestStatus[row.status] = row._count._all
  }

  const publicationStatus: Record<string, number> = {}
  for (const row of publicationGroups) {
    publicationStatus[row.status] = row._count._all
  }

  const draft = (requestStatus.DRAFT ?? 0) + (reviewEffectiveStatus.DRAFT ?? 0)
  const submitted = reviewEffectiveStatus.SUBMITTED ?? 0
  const approved = reviewEffectiveStatus.APPROVED ?? 0
  const prepared = requestStatus.HANDED_OFF ?? 0
  const scheduled = publicationStatus.SCHEDULED ?? 0
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

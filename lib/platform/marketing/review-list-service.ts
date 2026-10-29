import type { Prisma } from '@prisma/client'
import { MKT_LIST_DEFAULT_TAKE, MKT_LIST_MAX_TAKE } from '@/config/mkt-backend'
import { prisma } from '@/lib/db'
import { decodeMktListCursor, encodeMktListCursor } from '@/lib/platform/marketing/mkt-list-cursor'
import { validateMarketingListScope } from '@/lib/platform/marketing/mkt-list-scope'
import {
  computeReviewEffectiveStatus,
  reviewAllowedActions,
  type ReviewEffectiveStatus,
} from '@/lib/platform/marketing/review-presentation'
import type { MktResult } from '@/lib/platform/marketing/types'

const reviewListSelect = {
  id: true,
  customerAccountId: true,
  managedSiteId: true,
  marketingRequestId: true,
  marketingArtifactId: true,
  revisionHash: true,
  intendedAction: true,
  allowedChannel: true,
  allowedTarget: true,
  status: true,
  approverUserId: true,
  policyVersion: true,
  expiresAt: true,
  decidedAt: true,
  revokedAt: true,
  createdAt: true,
} satisfies Prisma.MarketingArtifactReviewSelect

type ReviewRow = Prisma.MarketingArtifactReviewGetPayload<{ select: typeof reviewListSelect }>

export type MarketingReviewListItem = ReviewRow & {
  effectiveStatus: ReviewEffectiveStatus
  allowedActions: ReturnType<typeof reviewAllowedActions>
}

function clampTake(take?: number): number {
  const defaultTake = Number.isFinite(MKT_LIST_DEFAULT_TAKE) ? MKT_LIST_DEFAULT_TAKE : 50
  const maxTake = Number.isFinite(MKT_LIST_MAX_TAKE) ? MKT_LIST_MAX_TAKE : 100
  return Math.min(Math.max(Number(take ?? defaultTake) || defaultTake, 1), maxTake)
}

export type ReviewStatusFilter = 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'REVOKED' | 'EXPIRED'

function parseReviewStatusFilter(raw?: string): MktResult<ReviewStatusFilter | undefined> {
  if (!raw) return { ok: true, value: undefined }
  const allowed: ReviewStatusFilter[] = ['SUBMITTED', 'APPROVED', 'REJECTED', 'REVOKED', 'EXPIRED']
  if (!allowed.includes(raw as ReviewStatusFilter)) {
    return { ok: false, code: 'VALIDATION', message: 'Invalid status filter' }
  }
  return { ok: true, value: raw as ReviewStatusFilter }
}

function buildStatusWhere(filter: ReviewStatusFilter, now: Date): Prisma.MarketingArtifactReviewWhereInput {
  switch (filter) {
    case 'APPROVED':
      return { status: 'APPROVED' }
    case 'REJECTED':
      return { status: 'REJECTED' }
    case 'REVOKED':
      return { OR: [{ status: 'REVOKED' }, { revokedAt: { not: null } }] }
    case 'EXPIRED':
      return {
        OR: [
          { status: 'EXPIRED' },
          { status: 'SUBMITTED', revokedAt: null, expiresAt: { lt: now } },
        ],
      }
    case 'SUBMITTED':
      return {
        status: 'SUBMITTED',
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
      }
    default:
      return {}
  }
}

function cursorWhere(
  base: Prisma.MarketingArtifactReviewWhereInput,
  cursor: { c: string; i: string },
): Prisma.MarketingArtifactReviewWhereInput {
  const createdAt = new Date(cursor.c)
  return {
    AND: [
      base,
      {
        OR: [{ createdAt: { lt: createdAt } }, { createdAt, id: { lt: cursor.i } }],
      },
    ],
  }
}

export type ListMarketingReviewsInput = {
  customerAccountId: string
  take?: number
  cursor?: string
  managedSiteId?: string
  marketingRequestId?: string
  marketingArtifactId?: string
  status?: string
  viewerCanDecide: boolean
}

export async function listMarketingReviews(
  input: ListMarketingReviewsInput,
): Promise<MktResult<{ reviews: MarketingReviewListItem[]; nextCursor?: string }>> {
  const scoped = await validateMarketingListScope({
    customerAccountId: input.customerAccountId,
    managedSiteId: input.managedSiteId,
    marketingRequestId: input.marketingRequestId,
    marketingArtifactId: input.marketingArtifactId,
  })
  if (!scoped.ok) return scoped

  const statusFilter = parseReviewStatusFilter(input.status)
  if (!statusFilter.ok) return statusFilter

  const take = clampTake(input.take)
  const now = new Date()

  let where: Prisma.MarketingArtifactReviewWhereInput = {
    customerAccountId: input.customerAccountId,
    ...(input.managedSiteId ? { managedSiteId: input.managedSiteId } : {}),
    ...(input.marketingRequestId ? { marketingRequestId: input.marketingRequestId } : {}),
    ...(input.marketingArtifactId ? { marketingArtifactId: input.marketingArtifactId } : {}),
    ...(statusFilter.value ? buildStatusWhere(statusFilter.value, now) : {}),
  }

  if (input.cursor) {
    const decoded = decodeMktListCursor(input.cursor)
    if (!decoded.ok) return decoded
    where = cursorWhere(where, decoded.value)
  }

  const rows = await prisma.marketingArtifactReview.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take,
    select: reviewListSelect,
  })

  const reviews: MarketingReviewListItem[] = rows.map((row) => {
    const effectiveStatus = computeReviewEffectiveStatus(row, now)
    const allowedActions = reviewAllowedActions({
      review: row,
      viewerCanDecide: input.viewerCanDecide,
      now,
    })
    return { ...row, effectiveStatus, allowedActions }
  })

  let nextCursor: string | undefined
  if (rows.length === take) {
    const last = rows[rows.length - 1]!
    nextCursor = encodeMktListCursor({ c: last.createdAt.toISOString(), i: last.id })
  }

  return { ok: true, value: { reviews, nextCursor } }
}

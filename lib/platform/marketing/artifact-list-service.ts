import type { MarketingArtifactReviewStatus, MarketingArtifactType, Prisma } from '@prisma/client'
import { MKT_LIST_DEFAULT_TAKE, MKT_LIST_MAX_TAKE } from '@/config/mkt-backend'
import { prisma } from '@/lib/db'
import { decodeMktListCursor, encodeMktListCursor } from '@/lib/platform/marketing/mkt-list-cursor'
import { validateMarketingListScope } from '@/lib/platform/marketing/mkt-list-scope'
import type { MktResult } from '@/lib/platform/marketing/types'

const artifactListSelect = {
  id: true,
  customerAccountId: true,
  managedSiteId: true,
  marketingRequestId: true,
  artifactType: true,
  revisionHash: true,
  generationMode: true,
  reviewStatus: true,
  locale: true,
  safetyClass: true,
  createdAt: true,
} satisfies Prisma.MarketingArtifactSelect

export type MarketingArtifactListItem = Prisma.MarketingArtifactGetPayload<{ select: typeof artifactListSelect }>

function clampTake(take?: number): number {
  const defaultTake = Number.isFinite(MKT_LIST_DEFAULT_TAKE) ? MKT_LIST_DEFAULT_TAKE : 50
  const maxTake = Number.isFinite(MKT_LIST_MAX_TAKE) ? MKT_LIST_MAX_TAKE : 100
  return Math.min(Math.max(Number(take ?? defaultTake) || defaultTake, 1), maxTake)
}

function parseArtifactType(raw?: string): MktResult<MarketingArtifactType | undefined> {
  if (!raw) return { ok: true, value: undefined }
  const allowed: MarketingArtifactType[] = [
    'SOCIAL_CAMPAIGN',
    'SOCIAL_POST',
    'LANDING_PAGE',
    'AD_CREATIVE',
    'SEO_FIX',
    'CAMPAIGN_PLAN',
  ]
  if (!allowed.includes(raw as MarketingArtifactType)) {
    return { ok: false, code: 'VALIDATION', message: 'Invalid artifactType filter' }
  }
  return { ok: true, value: raw as MarketingArtifactType }
}

function parseReviewStatus(raw?: string): MktResult<MarketingArtifactReviewStatus | undefined> {
  if (!raw) return { ok: true, value: undefined }
  const allowed: MarketingArtifactReviewStatus[] = [
    'DRAFT',
    'SUBMITTED',
    'APPROVED',
    'REJECTED',
    'EXPIRED',
    'REVOKED',
  ]
  if (!allowed.includes(raw as MarketingArtifactReviewStatus)) {
    return { ok: false, code: 'VALIDATION', message: 'Invalid reviewStatus filter' }
  }
  return { ok: true, value: raw as MarketingArtifactReviewStatus }
}

function cursorWhere(
  base: Prisma.MarketingArtifactWhereInput,
  cursor: { c: string; i: string },
): Prisma.MarketingArtifactWhereInput {
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

export type ListMarketingArtifactsInput = {
  customerAccountId: string
  take?: number
  cursor?: string
  managedSiteId?: string
  marketingRequestId?: string
  artifactType?: string
  reviewStatus?: string
}

export async function listMarketingArtifacts(
  input: ListMarketingArtifactsInput,
): Promise<MktResult<{ artifacts: MarketingArtifactListItem[]; nextCursor?: string }>> {
  const scoped = await validateMarketingListScope({
    customerAccountId: input.customerAccountId,
    managedSiteId: input.managedSiteId,
    marketingRequestId: input.marketingRequestId,
  })
  if (!scoped.ok) return scoped

  const artifactType = parseArtifactType(input.artifactType)
  if (!artifactType.ok) return artifactType
  const reviewStatus = parseReviewStatus(input.reviewStatus)
  if (!reviewStatus.ok) return reviewStatus

  const take = clampTake(input.take)
  let where: Prisma.MarketingArtifactWhereInput = {
    customerAccountId: input.customerAccountId,
    ...(input.managedSiteId ? { managedSiteId: input.managedSiteId } : {}),
    ...(input.marketingRequestId ? { marketingRequestId: input.marketingRequestId } : {}),
    ...(artifactType.value ? { artifactType: artifactType.value } : {}),
    ...(reviewStatus.value ? { reviewStatus: reviewStatus.value } : {}),
  }

  if (input.cursor) {
    const decoded = decodeMktListCursor(input.cursor)
    if (!decoded.ok) return decoded
    where = cursorWhere(where, decoded.value)
  }

  const artifacts = await prisma.marketingArtifact.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take,
    select: artifactListSelect,
  })

  let nextCursor: string | undefined
  if (artifacts.length === take) {
    const last = artifacts[artifacts.length - 1]!
    nextCursor = encodeMktListCursor({ c: last.createdAt.toISOString(), i: last.id })
  }

  return { ok: true, value: { artifacts, nextCursor } }
}

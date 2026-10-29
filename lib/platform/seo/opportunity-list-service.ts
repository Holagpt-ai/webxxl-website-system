import type { Prisma } from '@prisma/client'
import { SEO_LIST_DEFAULT_TAKE, SEO_LIST_MAX_TAKE } from '@/config/seo-backend'
import { prisma } from '@/lib/db'
import { requireManagedSiteInAccount } from '@/lib/platform/seo/site-scope'
import { decodeSeoListCursor, encodeSeoListCursor } from '@/lib/platform/seo/seo-list-cursor'
import type { SeoResult } from '@/lib/platform/seo/types'

function clampTake(take?: number): number {
  return Math.min(Math.max(Number(take ?? SEO_LIST_DEFAULT_TAKE) || SEO_LIST_DEFAULT_TAKE, 1), SEO_LIST_MAX_TAKE)
}

function parseOptionalEnum<T extends string>(raw: string | undefined, allowed: readonly T[], label: string): SeoResult<T | undefined> {
  if (!raw) return { ok: true, value: undefined }
  if (!allowed.includes(raw as T)) {
    return { ok: false, code: 'VALIDATION', message: `Invalid ${label} filter` }
  }
  return { ok: true, value: raw as T }
}

const OPPORTUNITY_STATES = [
  'OBSERVED_FINDING',
  'RECOMMENDED_ACTION',
  'DRAFT_PREPARED',
  'AWAITING_APPROVAL',
  'APPROVED',
  'PUBLISHED',
  'VERIFIED_OUTCOME',
] as const
const LEVELS = ['LOW', 'MEDIUM', 'HIGH'] as const

function cursorWhere(
  base: Prisma.SeoOpportunityWhereInput,
  cursor: { p: number; i: string },
): Prisma.SeoOpportunityWhereInput {
  return {
    AND: [
      base,
      {
        OR: [{ priorityScore: { lt: cursor.p } }, { priorityScore: cursor.p, id: { lt: cursor.i } }],
      },
    ],
  }
}

export async function listSeoOpportunitiesForSite(input: {
  customerAccountId: string
  managedSiteId: string
  take?: number
  cursor?: string
  state?: string
  severity?: string
  confidence?: string
}): Promise<SeoResult<{ opportunities: Awaited<ReturnType<typeof prisma.seoOpportunity.findMany>>; nextCursor?: string }>> {
  const site = await requireManagedSiteInAccount({
    siteId: input.managedSiteId,
    customerAccountId: input.customerAccountId,
  })
  if (!site.ok) return site

  const state = parseOptionalEnum(input.state, OPPORTUNITY_STATES, 'state')
  if (!state.ok) return state
  const severity = parseOptionalEnum(input.severity, LEVELS, 'severity')
  if (!severity.ok) return severity
  const confidence = parseOptionalEnum(input.confidence, LEVELS, 'confidence')
  if (!confidence.ok) return confidence

  const take = clampTake(input.take)
  let where: Prisma.SeoOpportunityWhereInput = {
    managedSiteId: site.value.id,
    customerAccountId: input.customerAccountId,
    ...(state.value ? { state: state.value } : {}),
    ...(severity.value ? { severity: severity.value } : {}),
    ...(confidence.value ? { confidence: confidence.value } : {}),
  }

  if (input.cursor) {
    const decoded = decodeSeoListCursor(input.cursor)
    if (!decoded.ok) return decoded
    where = cursorWhere(where, decoded.value)
  }

  const opportunities = await prisma.seoOpportunity.findMany({
    where,
    orderBy: [{ priorityScore: 'desc' }, { id: 'asc' }],
    take,
  })

  let nextCursor: string | undefined
  if (opportunities.length === take) {
    const last = opportunities[opportunities.length - 1]!
    nextCursor = encodeSeoListCursor({ p: last.priorityScore, i: last.id })
  }

  return { ok: true, value: { opportunities, nextCursor } }
}

import { prisma } from '@/lib/db'
import { requireManagedSiteInAccount } from '@/lib/platform/seo/site-scope'
import type { SeoResult } from '@/lib/platform/seo/types'

export type CompetitorIntelligenceDto = {
  competitorId: string
  managedSiteId: string
  marketId: string
  displayName: string
  placeId: string | null
  rankScore: number
  source: string
  evidenceRef: string | null
  signals: {
    categoryMatch: number | null
    serviceOverlap: number | null
    geoRelevance: number | null
  }
  observations: Array<{
    id: string
    observationKind: string
    observedAt: string
    ingestedAt: string
    detail: unknown
  }>
  localRank: {
    dataState: 'NOT_CONNECTED'
    limitations: string[]
  }
  measuredAt: string | null
  provenance: 'STORED_COMPETITOR_PROFILE'
}

export async function getCompetitorIntelligenceForSite(input: {
  customerAccountId: string
  managedSiteId: string
  competitorId: string
  observationTake?: number
}): Promise<SeoResult<CompetitorIntelligenceDto>> {
  const site = await requireManagedSiteInAccount({
    siteId: input.managedSiteId,
    customerAccountId: input.customerAccountId,
  })
  if (!site.ok) return site

  const profile = await prisma.competitorProfile.findFirst({
    where: {
      id: input.competitorId,
      customerAccountId: input.customerAccountId,
      managedSiteId: input.managedSiteId,
      excluded: false,
    },
  })
  if (!profile) {
    return { ok: false, code: 'NOT_FOUND', message: 'Competitor profile not found' }
  }

  const take = Math.min(Math.max(input.observationTake ?? 20, 1), 50)
  const competitorRefs = [profile.id, profile.placeId].filter((ref): ref is string => Boolean(ref))
  const observations = await prisma.competitorObservation.findMany({
    where: {
      customerAccountId: input.customerAccountId,
      managedSiteId: input.managedSiteId,
      competitorRef: { in: competitorRefs },
    },
    orderBy: { observedAt: 'desc' },
    take,
  })

  const measuredAt = observations[0]?.observedAt.toISOString() ?? profile.createdAt.toISOString()

  return {
    ok: true,
    value: {
      competitorId: profile.id,
      managedSiteId: profile.managedSiteId,
      marketId: profile.marketId,
      displayName: profile.displayName,
      placeId: profile.placeId,
      rankScore: profile.rankScore,
      source: profile.source,
      evidenceRef: profile.evidenceRef,
      signals: {
        categoryMatch: profile.categoryMatch,
        serviceOverlap: profile.serviceOverlap,
        geoRelevance: profile.geoRelevance,
      },
      observations: observations.map((row) => ({
        id: row.id,
        observationKind: row.observationKind,
        observedAt: row.observedAt.toISOString(),
        ingestedAt: row.ingestedAt.toISOString(),
        detail: row.detail,
      })),
      localRank: {
        dataState: 'NOT_CONNECTED',
        limitations: ['Live rank provider ingest disabled; map-pack positions are not synthesized.'],
      },
      measuredAt,
      provenance: 'STORED_COMPETITOR_PROFILE',
    },
  }
}
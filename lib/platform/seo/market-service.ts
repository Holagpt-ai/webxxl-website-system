import { prisma } from '@/lib/db'
import { rankCompetitorCandidates } from '@/lib/platform/seo/competitor-ranking'
import type { SeoResult } from '@/lib/platform/seo/types'

export async function createCompetitorMarket(input: {
  customerAccountId: string
  managedSiteId: string
  name: string
  category: string
  services?: string[]
  radiusKm?: number
  keywordThemes?: string[]
  candidateCompetitors?: {
    displayName: string
    placeId?: string
    categoryMatch: number
    serviceOverlap: number
    geoRelevance: number
    observedEvidence: number
  }[]
}): Promise<SeoResult<{ marketId: string; competitors: ReturnType<typeof rankCompetitorCandidates> }>> {
  const site = await prisma.managedSite.findFirst({
    where: { id: input.managedSiteId, customerAccountId: input.customerAccountId },
  })
  if (!site) return { ok: false, code: 'NOT_FOUND', message: 'Managed site not found' }

  const market = await prisma.competitorMarket.create({
    data: {
      customerAccountId: input.customerAccountId,
      managedSiteId: input.managedSiteId,
      name: input.name,
      category: input.category,
      services: input.services ?? [],
      radiusKm: input.radiusKm,
      keywordThemes: input.keywordThemes ?? [],
      sourceMethod: 'owner_defined_market_seo07',
    },
  })

  const ranked = rankCompetitorCandidates(
    (input.candidateCompetitors ?? []).map((c) => ({
      displayName: c.displayName,
      placeId: c.placeId,
      categoryMatch: c.categoryMatch,
      serviceOverlap: c.serviceOverlap,
      geoRelevance: c.geoRelevance,
      observedEvidence: c.observedEvidence,
    })),
  )

  if (ranked.length) {
    await prisma.competitorProfile.createMany({
      data: ranked.map((c) => ({
        customerAccountId: input.customerAccountId,
        managedSiteId: input.managedSiteId,
        marketId: market.id,
        displayName: c.displayName,
        placeId: c.placeId,
        categoryMatch: c.categoryMatch,
        serviceOverlap: c.serviceOverlap,
        geoRelevance: c.geoRelevance,
        rankScore: c.rankScore,
        source: c.source,
        evidenceRef: c.evidenceRef,
      })),
    })
  }

  return { ok: true, value: { marketId: market.id, competitors: ranked } }
}

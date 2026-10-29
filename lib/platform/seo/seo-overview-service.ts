import { prisma } from '@/lib/db'
import { buildSeoSiteOverviewDto } from '@/lib/platform/seo/dashboard-read-model'
import { loadGscStoredSiteBundle } from '@/lib/platform/seo/gsc-site-read'
import { applyStoredGscPerformanceToOverview } from '@/lib/platform/seo/overview-gsc-apply'
import type { CompetitorProvenanceSource } from '@/lib/platform/seo/competitor-ranking'
import { sortOpportunitiesDeterministic } from '@/lib/platform/seo/opportunity-engine'
import { localRankWhenProviderDisconnected } from '@/lib/platform/seo/local-rank-contract'
import type { SeoResult } from '@/lib/platform/seo/types'
import type { SeoFreshnessState } from '@/lib/platform/seo/types'

export async function loadSeoSiteOverview(input: {
  customerAccountId: string
  managedSiteId: string
}): Promise<SeoResult<ReturnType<typeof buildSeoSiteOverviewDto>>> {
  const site = await prisma.managedSite.findFirst({
    where: { id: input.managedSiteId, customerAccountId: input.customerAccountId },
    include: {
      seoSiteProfiles: true,
    },
  })
  if (!site) return { ok: false, code: 'NOT_FOUND', message: 'Site not found' }

  const [connections, inventoryGrouped, findingsCount, opportunities, workCount, competitors] = await Promise.all([
    prisma.siteAnalyticsConnection.findMany({ where: { managedSiteId: site.id } }),
    prisma.sitePageInventory.groupBy({
      by: ['status'],
      where: { managedSiteId: site.id },
      _count: { _all: true },
    }),
    prisma.seoPageFinding.count({ where: { managedSiteId: site.id } }),
    prisma.seoOpportunity.findMany({
      where: { managedSiteId: site.id },
      orderBy: { priorityScore: 'desc' },
      take: 25,
    }),
    prisma.seoWorkEvidence.count({ where: { managedSiteId: site.id } }),
    prisma.competitorProfile.findMany({
      where: { managedSiteId: site.id, excluded: false },
      orderBy: { rankScore: 'desc' },
      take: 5,
    }),
  ])

  const inventoryCounts = inventoryGrouped.map((row) => ({
    status: row.status,
    count: row._count._all,
  }))

  const gscConnection = connections.find((c) => c.provider === 'GSC')
  const rankState: SeoFreshnessState = localRankWhenProviderDisconnected().dataState

  const dto = buildSeoSiteOverviewDto({
    managedSiteId: site.id,
    canonicalHost: site.seoSiteProfiles[0]?.canonicalHost ?? site.domain ?? undefined,
    connections: connections.map((c) => ({
      provider: c.provider,
      propertyRef: c.propertyRef,
      dataState: c.dataState as SeoFreshnessState,
      verificationState: c.verificationState,
    })),
    inventoryCounts,
    gsc: null,
    findingsCount,
    competitors: competitors.map((c) => ({
      displayName: c.displayName,
      placeId: c.placeId ?? undefined,
      categoryMatch: c.categoryMatch ?? 0,
      serviceOverlap: c.serviceOverlap ?? 0,
      geoRelevance: c.geoRelevance ?? 0,
      observedEvidence: 0,
      rankScore: c.rankScore,
      source: c.source as CompetitorProvenanceSource,
      evidenceRef: c.evidenceRef ?? undefined,
    })),
    opportunities: sortOpportunitiesDeterministic(
      opportunities.map((o) => ({
        ruleId: o.ruleId,
        ruleVersion: o.ruleVersion,
        severity: o.severity as 'LOW' | 'MEDIUM' | 'HIGH',
        confidence: o.confidence as 'LOW' | 'MEDIUM' | 'HIGH',
        impactRationale: o.impactRationale,
        effortCategory: o.effortCategory as 'QUICK' | 'MODERATE' | 'SUBSTANTIAL',
        recommendation: o.recommendation,
        affectedUrl: o.affectedUrl ?? undefined,
        evidenceRef: o.evidenceRef,
        source: o.source,
        observedAt: o.observedAt,
        priorityScore: o.priorityScore,
        state: o.state === 'RECOMMENDED_ACTION' ? 'RECOMMENDED_ACTION' : 'OBSERVED_FINDING',
      })),
    ),
    workEvidenceCount: workCount,
    rankProviderState: rankState,
  })

  const gscBundle = await loadGscStoredSiteBundle({
    customerAccountId: input.customerAccountId,
    managedSiteId: site.id,
  })
  if (gscBundle.ok) {
    applyStoredGscPerformanceToOverview(dto, gscBundle.value.performance)
  } else if (gscConnection && gscConnection.dataState !== 'NOT_CONNECTED') {
    dto.sections.gscPerformance.dataState = gscConnection.dataState as SeoFreshnessState
  }

  return { ok: true, value: dto }
}

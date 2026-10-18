import type { SeoFreshnessState } from '@/lib/platform/seo/types'
import type { GscNormalizedReport } from '@/lib/platform/seo/gsc-types'
import type { SeoOpportunityDraft } from '@/lib/platform/seo/opportunity-engine'
import { aggregateGscAveragePosition, aggregateGscTraffic } from '@/lib/platform/seo/gsc-normalize'
import { summarizePageInventory, type PageInventoryCountRow } from '@/lib/platform/seo/page-inventory-summary'
import type { RankedCompetitor } from '@/lib/platform/seo/competitor-ranking'

export type SeoConnectionDto = {
  provider: string
  propertyRef?: string
  dataState: SeoFreshnessState
  verificationState: string
}

export type SeoSiteOverviewDto = {
  managedSiteId: string
  canonicalHost?: string
  sections: {
    overview: { dataState: SeoFreshnessState; lastObservedAt?: string }
    connections: SeoConnectionDto[]
    pageCounts: ReturnType<typeof summarizePageInventory> & { dataState: SeoFreshnessState }
    gscPerformance: {
      dataState: SeoFreshnessState
      clicks: number | null
      impressions: number | null
      ctr: number | null
      averagePosition: number | null
      averagePositionLabel: 'GSC average position (not fixed rank)'
      dateRange?: { start: string; end: string }
    }
    technicalFindings: { count: number; dataState: SeoFreshnessState }
    competitorMarket: { competitors: RankedCompetitor[]; dataState: SeoFreshnessState }
    priorityOpportunities: SeoOpportunityDraft[]
    workPerformed: { count: number; dataState: SeoFreshnessState }
    sourceFreshness: { providers: { provider: string; dataState: SeoFreshnessState; observedAt?: string }[] }
    outstandingActions: { count: number }
  }
}

export function buildSeoSiteOverviewDto(input: {
  managedSiteId: string
  canonicalHost?: string
  connections: SeoConnectionDto[]
  inventoryCounts: PageInventoryCountRow[]
  gsc?: GscNormalizedReport | null
  findingsCount: number
  competitors: RankedCompetitor[]
  opportunities: SeoOpportunityDraft[]
  workEvidenceCount: number
  rankProviderState: SeoFreshnessState
}): SeoSiteOverviewDto {
  const pageCounts = summarizePageInventory(input.inventoryCounts)
  const inventoryState: SeoFreshnessState = pageCounts.discovered + pageCounts.published > 0 ? 'READY' : 'NOT_CONNECTED'
  const gscState: SeoFreshnessState = input.gsc?.dataState ?? 'NOT_CONNECTED'
  const gscAgg = input.gsc ? aggregateGscTraffic(input.gsc.rows) : { clicks: null, impressions: null, ctr: null }
  const avgPos = input.gsc ? aggregateGscAveragePosition(input.gsc.rows) : null
  return {
    managedSiteId: input.managedSiteId,
    canonicalHost: input.canonicalHost,
    sections: {
      overview: {
        dataState: inventoryState === 'NOT_CONNECTED' && gscState === 'NOT_CONNECTED' ? 'NOT_CONNECTED' : 'PARTIAL',
        lastObservedAt: input.gsc?.observedAt,
      },
      connections: input.connections,
      pageCounts: { ...pageCounts, dataState: inventoryState },
      gscPerformance: {
        dataState: gscState,
        ...gscAgg,
        averagePosition: avgPos,
        averagePositionLabel: 'GSC average position (not fixed rank)',
        dateRange: input.gsc ? { start: input.gsc.startDate, end: input.gsc.endDate } : undefined,
      },
      technicalFindings: { count: input.findingsCount, dataState: input.findingsCount ? 'READY' : 'NOT_CONNECTED' },
      competitorMarket: {
        competitors: input.competitors,
        dataState: input.competitors.length ? 'READY' : 'NOT_CONNECTED',
      },
      priorityOpportunities: input.opportunities.slice(0, 10),
      workPerformed: { count: input.workEvidenceCount, dataState: input.workEvidenceCount ? 'READY' : 'NOT_CONNECTED' },
      sourceFreshness: {
        providers: [
          ...input.connections.map((c) => ({
            provider: c.provider,
            dataState: c.dataState,
          })),
          { provider: 'RANK_VENDOR', dataState: input.rankProviderState },
        ],
      },
      outstandingActions: { count: input.opportunities.length },
    },
  }
}

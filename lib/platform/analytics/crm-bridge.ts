import type { AnalyticsCrmRelationshipDto } from '@/lib/platform/analytics/dto'
import type { AnalyticsFreshnessState } from '@/lib/platform/analytics/types'

export type CrmCounts = {
  leadsCreated: number
  leadsConverted: number
  openDeals: number
}

export function buildAnalyticsCrmRelationship(counts: CrmCounts | null): AnalyticsCrmRelationshipDto {
  const dataState: AnalyticsFreshnessState = counts ? 'READY' : 'NOT_CONNECTED'
  return {
    leadsCreated: counts?.leadsCreated ?? 0,
    leadsConverted: counts?.leadsConverted ?? 0,
    openDeals: counts?.openDeals ?? 0,
    dataState,
    disclaimer:
      'Counts reflect CRM records in this customer account only. No marketing attribution or revenue impact is implied.',
  }
}

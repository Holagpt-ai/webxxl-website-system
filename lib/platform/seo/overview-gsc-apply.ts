import type { GscPerformanceReadModel } from '@/lib/platform/seo/gsc-performance-read'
import type { SeoSiteOverviewDto } from '@/lib/platform/seo/dashboard-read-model'

/** Apply stored GSC performance onto an overview DTO without duplicating aggregation logic. */
export function applyStoredGscPerformanceToOverview(dto: SeoSiteOverviewDto, gsc: GscPerformanceReadModel): void {
  dto.sections.gscPerformance = {
    dataState: gsc.dataState,
    clicks: gsc.clicks,
    impressions: gsc.impressions,
    ctr: gsc.ctr,
    averagePosition: gsc.averagePosition,
    averagePositionLabel: gsc.averagePositionLabel,
    dateRange: gsc.dateRange,
  }
  if (gsc.asOf) {
    dto.sections.overview.lastObservedAt = gsc.asOf
    if (dto.sections.overview.dataState === 'NOT_CONNECTED' && gsc.dataState !== 'NOT_CONNECTED') {
      dto.sections.overview.dataState = gsc.dataState === 'READY' ? 'PARTIAL' : gsc.dataState
    }
  }
}

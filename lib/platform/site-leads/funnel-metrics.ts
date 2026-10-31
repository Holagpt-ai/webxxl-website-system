import type { ManagedSiteLeadStatus, Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import type { SiteLeadSummaryMetric } from '@/lib/platform/site-leads/types'

export const SITE_LEAD_AWAITING_REVIEW_STATUSES: ManagedSiteLeadStatus[] = [
  'RECEIVED',
  'PENDING_REVIEW',
  'DUPLICATE_REVIEW',
]

export type SiteLeadStatusCountBundle = {
  leadsReceived: number
  awaitingReview: number
  qualified: number
  converted: number
  rejected: number
  duplicateReview: number
}

export function siteLeadSummaryMetricsFromCounts(counts: SiteLeadStatusCountBundle): Record<string, SiteLeadSummaryMetric> {
  return {
    leadsReceived: { value: counts.leadsReceived, scope: 'account_total' },
    awaitingReview: { value: counts.awaitingReview, scope: 'account_total' },
    qualified: { value: counts.qualified, scope: 'account_total' },
    converted: { value: counts.converted, scope: 'account_total' },
    rejected: { value: counts.rejected, scope: 'account_total' },
    duplicateReview: { value: counts.duplicateReview, scope: 'account_total' },
  }
}

export function websiteLeadBusinessSummaryMetrics(counts: SiteLeadStatusCountBundle): Record<string, SiteLeadSummaryMetric> {
  return {
    websiteLeadsReceived: { value: counts.leadsReceived, scope: 'account_total' },
    websiteLeadsAwaitingReview: { value: counts.awaitingReview, scope: 'account_total' },
    websiteLeadsQualified: { value: counts.qualified, scope: 'account_total' },
    websiteLeadsConverted: { value: counts.converted, scope: 'account_total' },
    websiteLeadsDuplicateReview: { value: counts.duplicateReview, scope: 'account_total' },
  }
}

export function siteLeadStatusCountBundleFromStatusMap(
  statusMap: ReadonlyMap<ManagedSiteLeadStatus, number> | Record<string, number>,
): SiteLeadStatusCountBundle {
  const read = (status: ManagedSiteLeadStatus): number => {
    if (statusMap instanceof Map) return statusMap.get(status) ?? 0
    return statusMap[status] ?? 0
  }
  const duplicateReview = read('DUPLICATE_REVIEW')
  const awaitingFromStatuses =
    read('RECEIVED') + read('PENDING_REVIEW') + duplicateReview
  return {
    leadsReceived: Array.from(
      statusMap instanceof Map ? statusMap.entries() : Object.entries(statusMap),
    ).reduce((sum, [, n]) => sum + n, 0),
    awaitingReview: awaitingFromStatuses,
    qualified: read('QUALIFIED'),
    converted: read('CONVERTED'),
    rejected: read('REJECTED'),
    duplicateReview,
  }
}

export async function countManagedSiteLeadStatusBundle(
  where: Prisma.ManagedSiteLeadWhereInput,
): Promise<SiteLeadStatusCountBundle> {
  const [leadsReceived, awaitingReview, qualified, converted, rejected, duplicateReview] = await Promise.all([
    prisma.managedSiteLead.count({ where }),
    prisma.managedSiteLead.count({ where: { ...where, status: { in: SITE_LEAD_AWAITING_REVIEW_STATUSES } } }),
    prisma.managedSiteLead.count({ where: { ...where, status: 'QUALIFIED' } }),
    prisma.managedSiteLead.count({ where: { ...where, status: 'CONVERTED' } }),
    prisma.managedSiteLead.count({ where: { ...where, status: 'REJECTED' } }),
    prisma.managedSiteLead.count({ where: { ...where, status: 'DUPLICATE_REVIEW' } }),
  ])
  return { leadsReceived, awaitingReview, qualified, converted, rejected, duplicateReview }
}

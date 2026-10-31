import { prisma } from '@/lib/db'
import { SITE_LEAD_INBOX_SAMPLE_LIMIT } from '@/config/site-lead-intake'
import {
  countManagedSiteLeadStatusBundle,
  siteLeadSummaryMetricsFromCounts,
} from '@/lib/platform/site-leads/funnel-metrics'
import type { SiteLeadResult } from '@/lib/platform/site-leads/types'

export async function getManagedSiteLeadSummary(input: {
  customerAccountId: string
  managedSiteId?: string | null
}): Promise<
  SiteLeadResult<{
    summary: ReturnType<typeof siteLeadSummaryMetricsFromCounts>
    attribution: { managedSiteId?: string; sourceSystem: string }
  }>
> {
  const baseWhere = {
    customerAccountId: input.customerAccountId,
    ...(input.managedSiteId ? { managedSiteId: input.managedSiteId } : {}),
  }

  const [counts, sampleRows] = await Promise.all([
    countManagedSiteLeadStatusBundle(baseWhere),
    prisma.managedSiteLead.findMany({
      where: baseWhere,
      orderBy: { createdAt: 'desc' },
      take: SITE_LEAD_INBOX_SAMPLE_LIMIT,
      select: { id: true },
    }),
  ])

  return {
    ok: true,
    value: {
      summary: {
        ...siteLeadSummaryMetricsFromCounts(counts),
        inboxSample: { value: sampleRows.length, scope: 'bounded_sample' },
      },
      attribution: {
        ...(input.managedSiteId ? { managedSiteId: input.managedSiteId } : {}),
        sourceSystem: 'managed_site_lead',
      },
    },
  }
}

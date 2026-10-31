import type { ManagedSiteLeadStatus } from '@prisma/client'
import { prisma } from '@/lib/db'
import { SITE_LEAD_INBOX_SAMPLE_LIMIT } from '@/config/site-lead-intake'
import type { SiteLeadResult, SiteLeadSummaryMetric } from '@/lib/platform/site-leads/types'

const AWAITING_STATUSES: ManagedSiteLeadStatus[] = ['RECEIVED', 'PENDING_REVIEW', 'DUPLICATE_REVIEW']

export async function getManagedSiteLeadSummary(input: {
  customerAccountId: string
  managedSiteId?: string | null
}): Promise<
  SiteLeadResult<{
    summary: Record<string, SiteLeadSummaryMetric>
    attribution: { managedSiteId?: string; sourceSystem: string }
  }>
> {
  const baseWhere = {
    customerAccountId: input.customerAccountId,
    ...(input.managedSiteId ? { managedSiteId: input.managedSiteId } : {}),
  }

  const [receivedTotal, awaitingReviewTotal, qualifiedTotal, convertedTotal, rejectedTotal, duplicateTotal, sampleRows] =
    await Promise.all([
      prisma.managedSiteLead.count({ where: baseWhere }),
      prisma.managedSiteLead.count({ where: { ...baseWhere, status: { in: AWAITING_STATUSES } } }),
      prisma.managedSiteLead.count({ where: { ...baseWhere, status: 'QUALIFIED' } }),
      prisma.managedSiteLead.count({ where: { ...baseWhere, status: 'CONVERTED' } }),
      prisma.managedSiteLead.count({ where: { ...baseWhere, status: 'REJECTED' } }),
      prisma.managedSiteLead.count({ where: { ...baseWhere, status: 'DUPLICATE_REVIEW' } }),
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
        leadsReceived: { value: receivedTotal, scope: 'account_total' },
        awaitingReview: { value: awaitingReviewTotal, scope: 'account_total' },
        qualified: { value: qualifiedTotal, scope: 'account_total' },
        converted: { value: convertedTotal, scope: 'account_total' },
        rejected: { value: rejectedTotal, scope: 'account_total' },
        duplicateReview: { value: duplicateTotal, scope: 'account_total' },
        inboxSample: { value: sampleRows.length, scope: 'bounded_sample' },
      },
      attribution: {
        ...(input.managedSiteId ? { managedSiteId: input.managedSiteId } : {}),
        sourceSystem: 'managed_site_lead',
      },
    },
  }
}

import type { ManagedSiteLeadStatus } from '@prisma/client'
import { prisma } from '@/lib/db'
import { BUSINESS_OVERVIEW_WEBSITE_LEAD_ACTIONS } from '@/config/site-lead-intake'
import { isPrismaMissingTableError } from '@/lib/platform/business-overview/access'
import type { BusinessModuleReadiness, BusinessOverviewAction } from '@/lib/platform/business-overview/types'
import { BUSINESS_DESTINATIONS } from '@/lib/platform/business-overview/destinations'
import { getManagedSiteLeadSummary } from '@/lib/platform/site-leads/summary-service'
import {
  SITE_LEAD_AWAITING_REVIEW_STATUSES,
  websiteLeadBusinessSummaryMetrics,
} from '@/lib/platform/site-leads/funnel-metrics'
import type { SiteLeadSummaryMetric } from '@/lib/platform/site-leads/types'

const AWAITING_ACTION_STATUSES: ManagedSiteLeadStatus[] = SITE_LEAD_AWAITING_REVIEW_STATUSES

const LEAD_REPORTING_UNAVAILABLE_MESSAGE =
  'Managed-site lead reporting is temporarily unavailable. Other CRM activity is still shown when available.'

export type WebsiteLeadOverviewAttachment = {
  summaryMetrics: Record<string, SiteLeadSummaryMetric>
  actions: BusinessOverviewAction[]
  reporting: {
    readiness: BusinessModuleReadiness
    summary?: Record<string, SiteLeadSummaryMetric>
  }
}

function leadReportingUnavailable(reasonCode: string): WebsiteLeadOverviewAttachment {
  return {
    summaryMetrics: {},
    actions: [],
    reporting: {
      readiness: {
        state: 'unavailable',
        reasonCode,
        message: LEAD_REPORTING_UNAVAILABLE_MESSAGE,
      },
    },
  }
}

function actionTitle(input: { status: ManagedSiteLeadStatus; formReference: string | null }): string {
  if (input.status === 'DUPLICATE_REVIEW') return 'Website lead duplicate review'
  if (input.formReference) return `Website lead: ${input.formReference}`
  return 'Website lead awaiting review'
}

export async function loadWebsiteLeadOverviewAttachment(input: {
  customerAccountId: string
  checkedAt: string
}): Promise<WebsiteLeadOverviewAttachment> {
  let summaryMetrics: Record<string, SiteLeadSummaryMetric> = {}

  try {
    const summaryResult = await getManagedSiteLeadSummary({ customerAccountId: input.customerAccountId })
    if (!summaryResult.ok) {
      return leadReportingUnavailable('SOURCE_UNAVAILABLE')
    }

    const counts = summaryResult.value.summary
    summaryMetrics = websiteLeadBusinessSummaryMetrics({
      leadsReceived: counts.leadsReceived?.value ?? 0,
      awaitingReview: counts.awaitingReview?.value ?? 0,
      qualified: counts.qualified?.value ?? 0,
      converted: counts.converted?.value ?? 0,
      rejected: counts.rejected?.value ?? 0,
      duplicateReview: counts.duplicateReview?.value ?? 0,
    })
  } catch (error) {
    if (isPrismaMissingTableError(error)) {
      return leadReportingUnavailable('DATA_UNAVAILABLE')
    }
    return leadReportingUnavailable('SOURCE_UNAVAILABLE')
  }

  let actions: BusinessOverviewAction[] = []
  try {
    const leadRows = await prisma.managedSiteLead.findMany({
      where: {
        customerAccountId: input.customerAccountId,
        status: { in: AWAITING_ACTION_STATUSES },
      },
      orderBy: { createdAt: 'desc' },
      take: BUSINESS_OVERVIEW_WEBSITE_LEAD_ACTIONS,
      select: {
        id: true,
        status: true,
        formReference: true,
        createdAt: true,
      },
    })

    actions = leadRows.map((lead) => ({
      module: 'crm',
      actionType:
        lead.status === 'DUPLICATE_REVIEW' ? 'crm.website_lead.duplicate_review' : 'crm.website_lead.awaiting_review',
      recordRef: { kind: 'managed_site_lead', id: lead.id },
      priority: lead.status === 'DUPLICATE_REVIEW' ? 'medium' : 'normal',
      title: actionTitle({ status: lead.status, formReference: lead.formReference }),
      destination: { path: BUSINESS_DESTINATIONS.crmLeads },
      timestamp: lead.createdAt.toISOString(),
      dueAt: null,
      customerAccountId: input.customerAccountId,
    }))
  } catch (error) {
    if (isPrismaMissingTableError(error)) {
      return leadReportingUnavailable('DATA_UNAVAILABLE')
    }
    actions = []
  }

  const evidenceTotal = Object.values(summaryMetrics)
    .filter((m) => m.scope === 'account_total')
    .reduce((sum, m) => sum + m.value, 0)

  return {
    summaryMetrics,
    actions,
    reporting: {
      readiness: {
        state: 'available',
        empty: evidenceTotal === 0,
        sourceCheckedAt: input.checkedAt,
        evidenceCount: evidenceTotal,
      },
      summary: summaryMetrics,
    },
  }
}

import type { PortalUser } from '@/lib/portal/authz'
import { getBusinessOverview } from '@/lib/platform/business-overview/service'
import { BUSINESS_DESTINATIONS } from '@/lib/platform/business-overview/destinations'
import { loadModuleAccessContext, resolveCrmModuleAccess, isPrismaMissingTableError } from '@/lib/platform/business-overview/access'
import { getManagedSiteLeadSummary } from '@/lib/platform/site-leads/summary-service'
import { websiteLeadBusinessSummaryMetrics } from '@/lib/platform/site-leads/funnel-metrics'
import { loadRecentLeadLineage } from '@/lib/platform/customer-operations/lineage'
import type { CustomerOperationsSummaryResponse } from '@/lib/platform/customer-operations/types'
import type { BusinessModuleReadiness } from '@/lib/platform/business-overview/types'

function leadPipelineUnavailable(reasonCode: string): CustomerOperationsSummaryResponse['leadPipeline'] {
  return {
    readiness: {
      state: 'unavailable',
      reasonCode,
      message: 'Managed-site lead pipeline is temporarily unavailable.',
    },
  }
}

export async function getCustomerOperationsSummary(portal: PortalUser): Promise<CustomerOperationsSummaryResponse> {
  const now = new Date()
  const accountId = portal.customerAccount.id
  const businessOverview = await getBusinessOverview(portal)

  const ctx = await loadModuleAccessContext(portal)
  const crmAccess = resolveCrmModuleAccess(ctx)

  let leadPipeline: CustomerOperationsSummaryResponse['leadPipeline'] = leadPipelineUnavailable('CRM_UNAVAILABLE')
  let recentLineage: CustomerOperationsSummaryResponse['recentLineage'] = []

  if (crmAccess === 'proceed') {
    try {
      const summaryResult = await getManagedSiteLeadSummary({ customerAccountId: accountId })
      if (summaryResult.ok) {
        const counts = summaryResult.value.summary
        const metrics = websiteLeadBusinessSummaryMetrics({
          leadsReceived: counts.leadsReceived?.value ?? 0,
          awaitingReview: counts.awaitingReview?.value ?? 0,
          qualified: counts.qualified?.value ?? 0,
          converted: counts.converted?.value ?? 0,
          rejected: counts.rejected?.value ?? 0,
          duplicateReview: counts.duplicateReview?.value ?? 0,
        })
        // Lifecycle statuses partition the total; adding them to leadsReceived would double-count.
        const evidenceTotal = counts.leadsReceived?.value ?? 0
        leadPipeline = {
          readiness: {
            state: 'available',
            empty: evidenceTotal === 0,
            sourceCheckedAt: now.toISOString(),
            evidenceCount: evidenceTotal,
          } satisfies BusinessModuleReadiness,
          summary: metrics,
        }
        recentLineage = await loadRecentLeadLineage(accountId)
      } else {
        leadPipeline = leadPipelineUnavailable('SOURCE_UNAVAILABLE')
      }
    } catch (error) {
      if (isPrismaMissingTableError(error)) {
        leadPipeline = leadPipelineUnavailable('DATA_UNAVAILABLE')
      } else {
        throw error
      }
    }
  } else {
    leadPipeline = { readiness: crmAccess }
  }

  return {
    customerAccountId: accountId,
    generatedAt: now.toISOString(),
    accountScope: 'session_membership',
    businessOverview,
    leadPipeline,
    recentLineage,
    navigation: {
      businessCommandCenter: '/dashboard/business',
      crmLeads: BUSINESS_DESTINATIONS.crmLeads,
      crmFunnel: '/dashboard/crm/leads/funnel',
      projectDashboard: BUSINESS_DESTINATIONS.projectDetail,
    },
  }
}

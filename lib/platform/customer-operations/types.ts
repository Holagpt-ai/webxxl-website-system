import type { BusinessOverviewResponse, BusinessModuleReadiness } from '@/lib/platform/business-overview/types'
import type { SiteLeadSummaryMetric } from '@/lib/platform/site-leads/types'

export type CustomerOperationsProjectContext = {
  projectId: string
  projectName: string
  progressPercent: number
  estimatedCompletionDate: string | null
  pendingApprovals: number
  openDependencies: number
  nextMilestoneTitle: string | null
  destination: { path: string }
}

export type CustomerOperationsCrmLinkage = {
  contactId: string
  openDeals: number
  openTasks: number
  destination: { path: string }
}

export type CustomerOperationsLeadLineage = {
  leadId: string
  status: string
  managedSiteId: string
  managedSiteName: string | null
  submittedAt: string
  qualification: {
    qualifiedAt: string | null
    convertedAt: string | null
    rejectedAt: string | null
  }
  crm: CustomerOperationsCrmLinkage | null
  project: CustomerOperationsProjectContext | null
  destinations: {
    leadReview: { path: string }
  }
}

export type CustomerOperationsSummaryResponse = {
  customerAccountId: string
  generatedAt: string
  accountScope: 'session_membership'
  businessOverview: BusinessOverviewResponse
  leadPipeline: {
    readiness: BusinessModuleReadiness
    summary?: Record<string, SiteLeadSummaryMetric>
  }
  recentLineage: CustomerOperationsLeadLineage[]
  navigation: {
    businessCommandCenter: string
    crmLeads: string
    crmFunnel: string
    projectDashboard: string
  }
}

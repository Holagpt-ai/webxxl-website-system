/** Append encoded query params to a locale-neutral dashboard path (Batch 9A deep links). */
export function dashboardPathWithQuery(path: string, query: Record<string, string>): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value) params.set(key, value)
  }
  const qs = params.toString()
  return qs ? `${path}?${qs}` : path
}

/** Locale-neutral customer destinations (Batch 16 locked routes). */
export const BUSINESS_DESTINATIONS = {
  crmTasks: '/dashboard/crm/tasks',
  crmTask: (taskId: string) => dashboardPathWithQuery('/dashboard/crm/tasks', { taskId }),
  crmPipeline: '/dashboard/crm/pipeline',
  crmDeal: (dealId: string) => dashboardPathWithQuery('/dashboard/crm/pipeline', { dealId }),
  crmMerges: '/dashboard/crm/merges',
  crmMergeProposal: (proposalId: string) => dashboardPathWithQuery('/dashboard/crm/merges', { proposalId }),
  crmLeads: '/dashboard/crm/leads',
  crmLead: (leadId: string) => dashboardPathWithQuery('/dashboard/crm/leads', { leadId }),
  crmContact: (contactId: string) => `/dashboard/crm/contacts/${encodeURIComponent(contactId)}`,
  marketingRequests: '/dashboard/marketing/requests',
  marketingRequest: (requestId: string) => `/dashboard/marketing/requests/${encodeURIComponent(requestId)}`,
  marketingApprovals: '/dashboard/marketing/approvals',
  marketingReview: (reviewId: string) => dashboardPathWithQuery('/dashboard/marketing/approvals', { reviewId }),
  marketingDeliverable: (artifactId: string) => `/dashboard/marketing/deliverables/${encodeURIComponent(artifactId)}`,
  marketingDeliverableReview: (artifactId: string, reviewId: string) =>
    dashboardPathWithQuery(`/dashboard/marketing/deliverables/${encodeURIComponent(artifactId)}`, { reviewId }),
  marketingCampaign: (campaignId: string) => `/dashboard/marketing/campaigns/${encodeURIComponent(campaignId)}`,
  marketingCampaignSchedulePrep: (campaignId: string) =>
    dashboardPathWithQuery(`/dashboard/marketing/campaigns/${encodeURIComponent(campaignId)}`, { prepare: 'schedule' }),
  aiEmployee: (employeeId: string) => dashboardPathWithQuery('/dashboard/ai-employees', { tab: 'employees', employeeId }),
  seoOpportunities: '/dashboard/seo/opportunities',
  seoOpportunitySite: (siteId: string) => `/dashboard/seo/opportunities?site=${encodeURIComponent(siteId)}`,
  seoOpportunity: (siteId: string, opportunityId: string) =>
    dashboardPathWithQuery('/dashboard/seo/opportunities', { site: siteId, opportunityId }),
  analyticsDashboard: (query?: { siteId?: string; tab?: string; rangeDays?: string }) =>
    dashboardPathWithQuery('/dashboard/analytics', {
      site: query?.siteId ?? '',
      tab: query?.tab ?? '',
      range: query?.rangeDays ?? '',
    }),
  commsInbox: '/dashboard/communications',
  commsInboxNeedsAttention: () => dashboardPathWithQuery('/dashboard/communications', { filter: 'needs_attention' }),
  commsInboxForInbox: (inboxMappingId: string) =>
    dashboardPathWithQuery('/dashboard/communications', { inbox: inboxMappingId }),
  commsConversation: (conversationId: string) =>
    `/dashboard/communications/conversations/${encodeURIComponent(conversationId)}`,
  projectApprovals: '/dashboard/approvals',
  projectApproval: (approvalId: string) => dashboardPathWithQuery('/dashboard/approvals', { approvalId }),
  projectDetail: '/dashboard/project',
  projectDependency: (dependencyId: string) => dashboardPathWithQuery('/dashboard/project', { dependencyId }),
  projectMilestone: (milestoneId: string) => dashboardPathWithQuery('/dashboard/project', { milestoneId }),
  portalFiles: (fileId?: string) =>
    fileId ? dashboardPathWithQuery('/dashboard/files', { fileId }) : '/dashboard/files',
  portalMessages: '/dashboard/messages',
  portalMessage: (commentId: string) => dashboardPathWithQuery('/dashboard/messages', { commentId }),
  portalRequests: '/dashboard/requests',
  portalChangeRequest: (requestId: string) => dashboardPathWithQuery('/dashboard/requests', { requestId }),
  portalSupport: '/dashboard/support',
  portalSupportTicket: (ticketId: string) => dashboardPathWithQuery('/dashboard/support', { ticketId }),
  dashboardOverview: '/dashboard',
} as const

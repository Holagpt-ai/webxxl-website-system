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
  marketingDeliverable: (artifactId: string) => `/dashboard/marketing/deliverables/${encodeURIComponent(artifactId)}`,
  seoOpportunities: '/dashboard/seo/opportunities',
  seoOpportunitySite: (siteId: string) => `/dashboard/seo/opportunities?site=${encodeURIComponent(siteId)}`,
  commsInbox: '/dashboard/communications',
  commsConversation: (conversationId: string) =>
    `/dashboard/communications/conversations/${encodeURIComponent(conversationId)}`,
  projectApprovals: '/dashboard/approvals',
  projectDetail: '/dashboard/project',
  dashboardOverview: '/dashboard',
} as const

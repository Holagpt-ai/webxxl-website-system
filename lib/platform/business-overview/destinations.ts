/** Locale-neutral customer destinations (Batch 16 locked routes). */
export const BUSINESS_DESTINATIONS = {
  crmTasks: '/dashboard/crm/tasks',
  crmPipeline: '/dashboard/crm/pipeline',
  crmMerges: '/dashboard/crm/merges',
  crmLeads: '/dashboard/crm/leads',
  crmLeadDetail: (leadId: string) => `/dashboard/crm/leads/${encodeURIComponent(leadId)}`,
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

import { BUSINESS_DESTINATIONS } from '@/lib/platform/business-overview/destinations'
import type { CustomerDashboardModule, DashboardModuleHandoff } from '@/lib/platform/customer-dashboard/types'
import type { BusinessModuleReadiness } from '@/lib/platform/business-overview/types'

type HandoffTemplate = {
  workspacePath: string
  siteScoped: boolean
  apis: { method: 'GET'; path: string }[]
}

const HANDOFF_TEMPLATES: Record<CustomerDashboardModule, HandoffTemplate> = {
  crm: {
    workspacePath: '/dashboard/crm',
    siteScoped: false,
    apis: [{ method: 'GET', path: '/api/v1/crm/contacts' }],
  },
  website_projects: {
    workspacePath: BUSINESS_DESTINATIONS.projectDetail,
    siteScoped: false,
    apis: [{ method: 'GET', path: '/api/v1/business/overview' }],
  },
  marketing_studio: {
    workspacePath: '/dashboard/marketing',
    siteScoped: false,
    apis: [{ method: 'GET', path: '/api/v1/marketing/requests' }],
  },
  local_seo: {
    workspacePath: '/dashboard/seo',
    siteScoped: true,
    apis: [{ method: 'GET', path: '/api/v1/seo/sites/{managedSiteId}/opportunities' }],
  },
  analytics: {
    workspacePath: '/dashboard/analytics',
    siteScoped: true,
    apis: [{ method: 'GET', path: '/api/v1/analytics/accounts/{customerAccountId}/overview' }],
  },
  communications: {
    workspacePath: BUSINESS_DESTINATIONS.commsInbox,
    siteScoped: false,
    apis: [{ method: 'GET', path: '/api/v1/comms/inboxes' }],
  },
  commerce: {
    workspacePath: '/dashboard/marketplace',
    siteScoped: false,
    apis: [
      { method: 'GET', path: '/api/v1/commerce/catalog' },
      { method: 'GET', path: '/api/v1/commerce/execution/summary' },
    ],
  },
  billing: {
    workspacePath: '/dashboard/billing',
    siteScoped: false,
    apis: [{ method: 'GET', path: '/api/v1/commerce/execution/summary' }],
  },
  ai_employees: {
    workspacePath: '/dashboard/ai-employees',
    siteScoped: false,
    apis: [{ method: 'GET', path: '/api/v1/ai-workforce/execution/summary' }],
  },
  automation: {
    workspacePath: '/dashboard/notifications',
    siteScoped: false,
    apis: [],
  },
}

export function buildModuleHandoff(
  module: CustomerDashboardModule,
  readiness: BusinessModuleReadiness,
  input?: { managedSiteId?: string | null },
): DashboardModuleHandoff {
  const template = HANDOFF_TEMPLATES[module]
  let workspacePath = template.workspacePath
  if (template.siteScoped && input?.managedSiteId) {
    if (module === 'local_seo') {
      workspacePath = BUSINESS_DESTINATIONS.seoOpportunitySite(input.managedSiteId)
    } else if (module === 'analytics') {
      workspacePath = BUSINESS_DESTINATIONS.analyticsDashboard({ siteId: input.managedSiteId })
    }
  }
  return {
    module,
    readiness,
    workspace: { label: module, path: workspacePath },
    apis: template.apis,
    siteScoped: template.siteScoped,
  }
}
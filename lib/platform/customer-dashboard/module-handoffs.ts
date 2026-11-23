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
    apis: [
      { method: 'GET', path: '/api/v1/marketing/requests' },
      { method: 'GET', path: '/api/v1/marketing/artifacts' },
      { method: 'GET', path: '/api/v1/marketing/reviews' },
      { method: 'GET', path: '/api/v1/marketing/reviews/{reviewId}' },
    ],
  },
  local_seo: {
    workspacePath: '/dashboard/seo',
    siteScoped: true,
    apis: [
      { method: 'GET', path: '/api/v1/seo/sites/{managedSiteId}/overview' },
      { method: 'GET', path: '/api/v1/seo/sites/{managedSiteId}/keywords' },
      { method: 'GET', path: '/api/v1/seo/sites/{managedSiteId}/keywords/intelligence' },
      { method: 'GET', path: '/api/v1/seo/sites/{managedSiteId}/competitors' },
      { method: 'GET', path: '/api/v1/seo/sites/{managedSiteId}/crawl-runs' },
      { method: 'GET', path: '/api/v1/seo/sites/{managedSiteId}/google/oauth-handoff' },
      { method: 'GET', path: '/api/v1/seo/sites/{managedSiteId}/opportunities' },
    ],
  },
  analytics: {
    workspacePath: '/dashboard/analytics',
    siteScoped: true,
    apis: [
      { method: 'GET', path: '/api/v1/analytics/accounts/{customerAccountId}/overview' },
      { method: 'GET', path: '/api/v1/analytics/accounts/{customerAccountId}/traffic' },
      { method: 'GET', path: '/api/v1/analytics/accounts/{customerAccountId}/search' },
      { method: 'GET', path: '/api/v1/analytics/accounts/{customerAccountId}/local' },
      { method: 'GET', path: '/api/v1/analytics/accounts/{customerAccountId}/conversions' },
      { method: 'GET', path: '/api/v1/analytics/accounts/{customerAccountId}/measurements' },
      { method: 'GET', path: '/api/v1/analytics/accounts/{customerAccountId}/google/readiness' },
    ],
  },
  communications: {
    workspacePath: BUSINESS_DESTINATIONS.commsInbox,
    siteScoped: false,
    apis: [
      { method: 'GET', path: '/api/v1/communications/inboxes' },
      { method: 'GET', path: '/api/v1/communications/conversations' },
      { method: 'GET', path: '/api/v1/communications/connections' },
      { method: 'GET', path: '/api/v1/communications/execution/summary' },
      { method: 'GET', path: '/api/v1/communications/provider-readiness' },
    ],
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
  input?: { managedSiteId?: string | null; customerAccountId?: string | null },
): DashboardModuleHandoff {
  const template = HANDOFF_TEMPLATES[module]
  let workspacePath = template.workspacePath
  let apis = template.apis
  if (input?.customerAccountId) {
    apis = apis.map((row) => ({
      ...row,
      path: row.path.replace('{customerAccountId}', input.customerAccountId!),
    }))
  }
  if (template.siteScoped && input?.managedSiteId) {
    if (module === 'local_seo') {
      workspacePath = BUSINESS_DESTINATIONS.seoOpportunitySite(input.managedSiteId)
      const siteId = input.managedSiteId
      apis = apis.map((row) => ({
        ...row,
        path: row.path.replace('{managedSiteId}', siteId),
      }))
    } else if (module === 'analytics') {
      workspacePath = BUSINESS_DESTINATIONS.analyticsDashboard({ siteId: input.managedSiteId })
    }
  }
  return {
    module,
    readiness,
    workspace: { label: module, path: workspacePath },
    apis,
    siteScoped: template.siteScoped,
  }
}
import type { BusinessModuleReadiness } from '@/lib/platform/business-overview/types'

export const CUSTOMER_DASHBOARD_MODULES = [
  'crm',
  'website_projects',
  'marketing_studio',
  'local_seo',
  'analytics',
  'communications',
  'commerce',
  'billing',
  'ai_employees',
  'automation',
] as const

export type CustomerDashboardModule = (typeof CUSTOMER_DASHBOARD_MODULES)[number]

export type DashboardNavigationLink = {
  label: string
  path: string
}

export type DashboardModuleHandoff = {
  module: CustomerDashboardModule
  readiness: BusinessModuleReadiness
  workspace: DashboardNavigationLink
  /** Primary read APIs for this module (locale-neutral). */
  apis: { method: 'GET'; path: string }[]
  siteScoped: boolean
}

export type CustomerDashboardSelection = {
  activeProject: { id: string; name: string } | null
  activeManagedSite: { id: string; name: string } | null
}

export type CustomerDashboardContextResponse = {
  customerAccountId: string
  generatedAt: string
  accountScope: 'session_membership'
  selection: CustomerDashboardSelection
  modules: DashboardModuleHandoff[]
  crossModule: {
    businessOverview: string
    customerOperations: string
    siteIntelligence: string
    businessCommandCenter: string
    marketingWorkspaces: {
      requests: string
      deliverables: string
      approvals: string
    }
  }
}
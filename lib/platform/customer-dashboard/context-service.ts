import type { PortalUser } from '@/lib/portal/authz'
import { getActiveManagedSite, getActiveProject } from '@/lib/portal/authz'
import { buildModuleHandoff } from '@/lib/platform/customer-dashboard/module-handoffs'
import { MARKETING_STUDIO_WORKSPACES } from '@/lib/platform/marketing/list-handoffs'
import {
  CUSTOMER_DASHBOARD_MODULES,
  type CustomerDashboardContextResponse,
} from '@/lib/platform/customer-dashboard/types'
import {
  dashboardModuleAccessResolvers,
  loadModuleAccessContext,
  readinessOrAvailable,
} from '@/lib/platform/customer-dashboard/access'

export async function getCustomerDashboardContext(portal: PortalUser): Promise<CustomerDashboardContextResponse> {
  const now = new Date()
  const ctx = await loadModuleAccessContext(portal)
  const activeProject = await getActiveProject(portal.customerAccount.id)
  const activeManagedSite = await getActiveManagedSite(portal.customerAccount.id, activeProject?.id ?? null)

  const modules = CUSTOMER_DASHBOARD_MODULES.map((module) => {
    const access = dashboardModuleAccessResolvers[module](ctx as never)
    const readiness = readinessOrAvailable(access, now)
    return buildModuleHandoff(module, readiness, { managedSiteId: activeManagedSite?.id ?? null })
  })

  return {
    customerAccountId: portal.customerAccount.id,
    generatedAt: now.toISOString(),
    accountScope: 'session_membership',
    selection: {
      activeProject: activeProject ? { id: activeProject.id, name: activeProject.name } : null,
      activeManagedSite: activeManagedSite
        ? { id: activeManagedSite.id, name: activeManagedSite.name }
        : null,
    },
    modules,
    crossModule: {
      businessOverview: '/api/v1/business/overview',
      customerOperations: '/api/v1/customer-operations/summary',
      siteIntelligence: '/api/v1/site-intelligence/sites/{managedSiteId}/summary',
      businessCommandCenter: '/dashboard/business',
      marketingWorkspaces: {
        requests: MARKETING_STUDIO_WORKSPACES.requests,
        deliverables: MARKETING_STUDIO_WORKSPACES.deliverables,
        approvals: MARKETING_STUDIO_WORKSPACES.approvals,
      },
    },
  }
}
'use server'

import { prisma } from '@/lib/db'
import { requireCustomerMembership, requireUser } from '@/lib/portal/authz'
import { setActiveCustomerAccountCookie } from '@/lib/portal/active-customer-account'
import { clearActiveProjectCookie, setActiveProjectCookie } from '@/lib/portal/active-project'
import {
  clearActiveManagedSiteCookie,
  setActiveManagedSiteCookie,
} from '@/lib/portal/active-managed-site'
import { revalidateCustomerDashboardLayouts } from '@/lib/portal/dashboard-revalidate'

export type CustomerPortalActionResult = { ok: true } | { ok: false; error: string }

export async function switchCustomerAccountAction(customerAccountId: string): Promise<CustomerPortalActionResult> {
  try {
    const user = await requireUser()
    const membership = await prisma.customerMembership.findUnique({
      where: { userId_customerAccountId: { userId: user.id, customerAccountId } },
    })
    if (!membership) return { ok: false, error: 'unauthorized' }
    await setActiveCustomerAccountCookie(customerAccountId)
    await clearActiveProjectCookie()
    await clearActiveManagedSiteCookie()
    revalidateCustomerDashboardLayouts()
    return { ok: true }
  } catch {
    return { ok: false, error: 'unauthorized' }
  }
}

export async function switchCustomerProjectAction(projectId: string): Promise<CustomerPortalActionResult> {
  try {
    const portal = await requireCustomerMembership()
    const project = await prisma.project.findFirst({
      where: { id: projectId, customerAccountId: portal.customerAccount.id },
      select: { id: true },
    })
    if (!project) return { ok: false, error: 'unauthorized' }
    await setActiveProjectCookie(project.id)
    revalidateCustomerDashboardLayouts()
    return { ok: true }
  } catch {
    return { ok: false, error: 'unauthorized' }
  }
}

export async function switchManagedSiteAction(managedSiteId: string): Promise<CustomerPortalActionResult> {
  try {
    const portal = await requireCustomerMembership()
    const site = await prisma.managedSite.findFirst({
      where: { id: managedSiteId, customerAccountId: portal.customerAccount.id },
      select: { id: true },
    })
    if (!site) return { ok: false, error: 'unauthorized' }
    await setActiveManagedSiteCookie(site.id)
    revalidateCustomerDashboardLayouts()
    return { ok: true }
  } catch {
    return { ok: false, error: 'unauthorized' }
  }
}
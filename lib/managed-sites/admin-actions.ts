'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin, requireManagedSiteStaffAccess, requireStaff } from '@/lib/portal/authz'
import { prisma } from '@/lib/db'
import {
  approveManagedSiteChange,
  registerManagedSite,
  setManagedSiteCapability,
  updateManagedSiteConnection,
  updateManagedSiteProfile,
} from '@/lib/managed-sites/operations'

export type AdminSiteActionResult = { ok: true; siteId?: string } | { ok: false; error: string }

function revalidateSites() {
  revalidatePath('/admin/sites', 'layout')
  revalidatePath('/es/admin/sites', 'layout')
  revalidatePath('/dashboard/sites', 'layout')
  revalidatePath('/es/dashboard/sites', 'layout')
  revalidatePath('/admin/requests', 'layout')
}

export async function createManagedSiteAction(input: {
  customerAccountId: string
  projectId?: string
  name: string
  domain: string
  canonicalUrl: string
  status?: string
  platform?: string
  locale?: string
  connectionType?: string
  adapterKey?: string
  externalAdminUrl?: string
}): Promise<AdminSiteActionResult> {
  try {
    const staff = await requireStaff()
    const created = await registerManagedSite({
      actorRole: staff.role,
      customerAccountId: input.customerAccountId,
      projectId: input.projectId,
      name: input.name,
      domain: input.domain,
      canonicalUrl: input.canonicalUrl,
      status: input.status,
      platform: input.platform,
      locale: input.locale,
      connectionType: input.connectionType,
      adapterKey: input.adapterKey,
      externalAdminUrl: input.externalAdminUrl,
    })
    if (!created.ok) return created
    revalidateSites()
    return { ok: true, siteId: created.siteId }
  } catch {
    return { ok: false, error: 'unauthorized' }
  }
}

export async function updateManagedSiteProfileAction(
  siteId: string,
  input: {
    name?: string
    status?: string
    platform?: string
    projectId?: string | null
    externalAdminUrl?: string | null
    canonicalUrl?: string
  },
): Promise<AdminSiteActionResult> {
  try {
    const { site } = await requireManagedSiteStaffAccess(siteId)
    const updated = await updateManagedSiteProfile({
      siteId: site.id,
      customerAccountId: site.customerAccountId,
      ...input,
    })
    if (!updated.ok) return updated
    revalidateSites()
    return { ok: true }
  } catch {
    return { ok: false, error: 'unauthorized' }
  }
}

export async function updateManagedSiteConnectionAction(
  siteId: string,
  adapterKey: string,
  connectionType: string,
  connectionRef?: string,
): Promise<AdminSiteActionResult> {
  try {
    await requireAdmin()
    const { site } = await requireManagedSiteStaffAccess(siteId)
    const updated = await updateManagedSiteConnection({
      siteId: site.id,
      adapterKey,
      connectionType,
      connectionRef,
    })
    if (!updated.ok) return updated
    revalidateSites()
    return { ok: true }
  } catch {
    return { ok: false, error: 'unauthorized' }
  }
}

export async function setManagedSiteCapabilityAction(
  siteId: string,
  capabilityKey: string,
  enabled: boolean,
  executionMode?: string,
): Promise<AdminSiteActionResult> {
  try {
    const { site } = await requireManagedSiteStaffAccess(siteId)
    const updated = await setManagedSiteCapability({
      siteId: site.id,
      capabilityKey,
      enabled,
      executionMode,
    })
    if (!updated.ok) return updated
    revalidateSites()
    return { ok: true }
  } catch {
    return { ok: false, error: 'unauthorized' }
  }
}

export async function approveManagedSiteChangeAction(changeId: string): Promise<AdminSiteActionResult & { applied?: boolean; status?: string }> {
  try {
    const staff = await requireStaff()
    const change = await prisma.managedSiteChange.findUnique({ where: { id: changeId } })
    if (!change) return { ok: false, error: 'not_found' }
    const { site } = await requireManagedSiteStaffAccess(change.managedSiteId)
    const result = await approveManagedSiteChange({
      actorUserId: staff.id,
      change,
      site: {
        id: site.id,
        name: site.name,
        domain: site.domain,
        projectId: site.projectId,
        customerAccountId: site.customerAccountId,
        adapterKey: site.adapterKey,
        connectionType: site.connectionType,
        connectionRef: site.connectionRef,
      },
    })
    revalidateSites()
    if (!result.ok) return { ok: false, error: result.error }
    return { ok: true, applied: result.applied, status: result.status }
  } catch {
    return { ok: false, error: 'unauthorized' }
  }
}

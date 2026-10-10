'use server'

import { revalidatePath } from 'next/cache'
import { requireCapabilityAccess } from '@/lib/portal/authz'
import { submitManagedSiteChange } from '@/lib/managed-sites/operations'

export type ManagedSiteActionResult =
  | { ok: true; applied: boolean; status: string }
  | { ok: false; error: string; applied: false }

function revalidateSites() {
  revalidatePath('/dashboard/sites', 'layout')
  revalidatePath('/es/dashboard/sites', 'layout')
  revalidatePath('/admin/sites', 'layout')
  revalidatePath('/es/admin/sites', 'layout')
  revalidatePath('/admin/requests', 'layout')
}

export async function submitManagedSiteRequestAction(
  siteId: string,
  capabilityKey: string,
  requestText: string,
): Promise<ManagedSiteActionResult> {
  try {
    const { portal, site, capability } = await requireCapabilityAccess(siteId, capabilityKey)
    const result = await submitManagedSiteChange({
      actorUserId: portal.id,
      actor: 'customer',
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
      assignments: site.capabilities.map((item) => ({
        capabilityKey: item.capabilityKey,
        enabled: item.enabled,
        executionMode: item.executionMode,
      })),
      capabilityKey: capability.key,
      requestText,
    })
    if (result.ok || result.status) revalidateSites()
    if (!result.ok) return { ok: false, error: result.error, applied: false }
    return { ok: true, applied: result.applied, status: result.status }
  } catch {
    return { ok: false, error: 'unauthorized', applied: false }
  }
}

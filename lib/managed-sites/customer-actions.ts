'use server'

import { revalidatePath } from 'next/cache'
import { requireCapabilityAccess, requireCustomerMembership } from '@/lib/portal/authz'
import { submitManagedSiteCampaignDraft, submitManagedSiteChange } from '@/lib/managed-sites/operations'
import {
  discardManagedSiteAiDraft,
  generateManagedSiteAiDraft,
  submitContentEditDirectToWebxxl,
  submitManagedSiteAiDraftForReview,
} from '@/lib/managed-sites/ai/service'
import type { AiContentDraftV1 } from '@/lib/managed-sites/ai/types'

export type ManagedSiteActionResult =
  | { ok: true; applied: boolean; status: string }
  | { ok: false; error: string; applied: false }

export type AiDraftActionResult =
  | { ok: true; changeId: string; status: 'DRAFT'; draft: AiContentDraftV1 }
  | { ok: false; error: string }

function siteSnapshotFromAccess(site: {
  id: string
  name: string
  domain: string
  projectId: string | null
  customerAccountId: string
  adapterKey: string
  connectionType: string
  connectionRef: string | null
}) {
  return {
    id: site.id,
    name: site.name,
    domain: site.domain,
    projectId: site.projectId,
    customerAccountId: site.customerAccountId,
    adapterKey: site.adapterKey,
    connectionType: site.connectionType,
    connectionRef: site.connectionRef,
  }
}

function revalidateSites() {
  revalidatePath('/dashboard/sites', 'layout')
  revalidatePath('/es/dashboard/sites', 'layout')
  revalidatePath('/admin/sites', 'layout')
  revalidatePath('/es/admin/sites', 'layout')
  revalidatePath('/admin/requests', 'layout')
}

export async function submitManagedSiteCampaignDraftAction(
  siteId: string,
  capabilityKey: string,
  structuredPayload: Record<string, unknown>,
  requestText?: string,
): Promise<ManagedSiteActionResult> {
  try {
    const { portal, site, capability } = await requireCapabilityAccess(siteId, capabilityKey)
    const result = await submitManagedSiteCampaignDraft({
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
      structuredPayload,
      requestText,
    })
    if (result.ok || result.status) revalidateSites()
    if (!result.ok) return { ok: false, error: result.error, applied: false }
    return { ok: true, applied: result.applied, status: result.status }
  } catch {
    return { ok: false, error: 'unauthorized', applied: false }
  }
}

export async function generateManagedSiteAiDraftAction(
  siteId: string,
  requestText: string,
  locale: 'en' | 'es',
): Promise<AiDraftActionResult> {
  try {
    const { portal, site, capability } = await requireCapabilityAccess(siteId, 'content.edit')
    const result = await generateManagedSiteAiDraft({
      actorUserId: portal.id,
      site: siteSnapshotFromAccess(site),
      assignments: site.capabilities.map((item) => ({
        capabilityKey: item.capabilityKey,
        enabled: item.enabled,
        executionMode: item.executionMode,
      })),
      capabilityKey: capability.key,
      requestText,
      locale,
    })
    if (!result.ok) return { ok: false, error: result.error }
    revalidateSites()
    return result
  } catch {
    return { ok: false, error: 'unauthorized' }
  }
}

export async function submitManagedSiteAiDraftForReviewAction(changeId: string): Promise<ManagedSiteActionResult> {
  try {
    const portal = await requireCustomerMembership()
    const result = await submitManagedSiteAiDraftForReview({
      actorUserId: portal.id,
      customerAccountId: portal.customerAccount.id,
      changeId,
    })
    if (result.ok || result.status) revalidateSites()
    if (!result.ok) return { ok: false, error: result.error, applied: false }
    return { ok: true, applied: result.applied, status: result.status }
  } catch {
    return { ok: false, error: 'unauthorized', applied: false }
  }
}

export async function discardManagedSiteAiDraftAction(changeId: string): Promise<ManagedSiteActionResult> {
  try {
    const portal = await requireCustomerMembership()
    const result = await discardManagedSiteAiDraft({
      actorUserId: portal.id,
      customerAccountId: portal.customerAccount.id,
      changeId,
    })
    if (result.ok || result.status) revalidateSites()
    if (!result.ok) return { ok: false, error: result.error, applied: false }
    return { ok: true, applied: result.applied, status: result.status }
  } catch {
    return { ok: false, error: 'unauthorized', applied: false }
  }
}

export async function submitContentEditDirectToWebxxlAction(
  siteId: string,
  requestText: string,
): Promise<ManagedSiteActionResult> {
  try {
    const { portal, site, capability } = await requireCapabilityAccess(siteId, 'content.edit')
    const result = await submitContentEditDirectToWebxxl({
      actorUserId: portal.id,
      site: siteSnapshotFromAccess(site),
      assignments: site.capabilities.map((item) => ({
        capabilityKey: item.capabilityKey,
        enabled: item.enabled,
        executionMode: item.executionMode,
      })),
      requestText,
    })
    if (result.ok || result.status) revalidateSites()
    if (!result.ok) return { ok: false, error: result.error, applied: false }
    return { ok: true, applied: result.applied, status: result.status }
  } catch {
    return { ok: false, error: 'unauthorized', applied: false }
  }
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

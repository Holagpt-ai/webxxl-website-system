import { prisma } from '@/lib/db'
import { formatActivitySummary, writeProjectActivity } from '@/lib/portal/activity'
import { getCapabilityDefinition } from '@/lib/managed-sites/capabilities'
import { routeManagedSiteRequest } from '@/lib/managed-sites/routing'
import type { CapabilityAssignment } from '@/lib/managed-sites/capabilities'
import { buildAiContentChangeRequestDescription } from '@/lib/managed-sites/ai/change-request-description'
import { getManagedSiteAiProvider, isManagedSiteAiConfigured } from '@/lib/managed-sites/ai/provider'
import { parseAiContentDraftV1 } from '@/lib/managed-sites/ai/schema'
import type { AiContentDraftV1 } from '@/lib/managed-sites/ai/types'
import type { ManagedSiteChangeStatus } from '@prisma/client'

type SiteSnapshot = {
  id: string
  name: string
  domain: string
  projectId: string | null
  customerAccountId: string
  adapterKey: string
  connectionType: string
  connectionRef: string | null
}

type SiteMutationResult =
  | { ok: true; applied: boolean; status: ManagedSiteChangeStatus; changeId?: string; changeRequestId?: string }
  | { ok: false; error: string; applied: false; status?: ManagedSiteChangeStatus }

export const AI_CONTENT_CAPABILITY = 'content.edit' as const

export type AiDraftMutationResult =
  | { ok: true; changeId: string; status: 'DRAFT'; draft: AiContentDraftV1 }
  | { ok: false; error: string }

function siteAssignments(assignments: CapabilityAssignment[]) {
  return assignments
}

export async function generateManagedSiteAiDraft(input: {
  actorUserId: string
  site: SiteSnapshot
  assignments: CapabilityAssignment[]
  capabilityKey: string
  requestText: string
  locale: 'en' | 'es'
}): Promise<AiDraftMutationResult> {
  const requestText = input.requestText.trim()
  if (!requestText) return { ok: false, error: 'empty' }
  if (requestText.length > 5000) return { ok: false, error: 'too_long' }
  if (input.capabilityKey !== AI_CONTENT_CAPABILITY) return { ok: false, error: 'unsupported_capability' }

  const assignment = input.assignments.find((item) => item.capabilityKey === input.capabilityKey) ?? null
  const decision = routeManagedSiteRequest({
    capabilityKey: input.capabilityKey,
    assignment,
    actor: 'customer',
  })
  if (!decision.capability || decision.mode !== 'AI_ASSISTED') {
    return { ok: false, error: decision.reason === 'unknown' ? 'unknown' : decision.reason }
  }

  if (!isManagedSiteAiConfigured()) return { ok: false, error: 'ai_not_configured' }
  const provider = getManagedSiteAiProvider()
  if (!provider) return { ok: false, error: 'ai_not_configured' }

  const generated = await provider.generateContentDraft({
    siteName: input.site.name,
    siteDomain: input.site.domain,
    locale: input.locale,
    requestText,
  })
  if (!generated.ok) return { ok: false, error: generated.error }

  const model = process.env.MANAGED_SITE_AI_MODEL?.trim() ?? 'configured'
  const change = await prisma.managedSiteChange.create({
    data: {
      managedSiteId: input.site.id,
      requestedById: input.actorUserId,
      capabilityKey: input.capabilityKey,
      executionMode: 'AI_ASSISTED',
      status: 'DRAFT',
      requestText,
      structuredPayload: generated.draft,
      previewPayload: generated.draft,
      resultMetadata: {
        ai: {
          status: 'generated',
          provider: process.env.MANAGED_SITE_AI_PROVIDER?.trim() ?? 'openai-compatible',
          model,
          schemaVersion: 1,
        },
        executed: false,
      },
    },
  })

  return { ok: true, changeId: change.id, status: 'DRAFT', draft: generated.draft }
}

export async function submitManagedSiteAiDraftForReview(input: {
  actorUserId: string
  customerAccountId: string
  changeId: string
}): Promise<SiteMutationResult> {
  const change = await prisma.managedSiteChange.findUnique({
    where: { id: input.changeId },
    include: { managedSite: true },
  })
  if (!change || change.managedSite.customerAccountId !== input.customerAccountId) {
    return { ok: false, error: 'not_found', applied: false }
  }
  if (change.requestedById !== input.actorUserId) return { ok: false, error: 'unauthorized', applied: false }
  if (change.capabilityKey !== AI_CONTENT_CAPABILITY || change.executionMode !== 'AI_ASSISTED') {
    return { ok: false, error: 'invalid', applied: false }
  }
  if (change.status !== 'DRAFT') return { ok: false, error: 'invalid_status', applied: false }

  const draft = parseAiContentDraftV1(change.structuredPayload)
  if (!draft) return { ok: false, error: 'invalid', applied: false }

  const site = change.managedSite
  if (!site.projectId) return { ok: false, error: 'project_required', applied: false, status: 'DRAFT' }
  const project = await prisma.project.findFirst({
    where: { id: site.projectId, customerAccountId: input.customerAccountId },
  })
  if (!project) return { ok: false, error: 'project_required', applied: false, status: 'DRAFT' }

  const definition = getCapabilityDefinition(AI_CONTENT_CAPABILITY)
  const title = `${site.name}: ${definition?.label.en ?? 'Content update'}`
  const description = buildAiContentChangeRequestDescription(change.requestText ?? '', draft)

  const changeRequest = await prisma.changeRequest.create({
    data: {
      projectId: project.id,
      submittedById: input.actorUserId,
      managedSiteId: site.id,
      title,
      description,
    },
  })

  await prisma.managedSiteChange.update({
    where: { id: change.id },
    data: {
      status: 'ESCALATED',
      changeRequestId: changeRequest.id,
      resultMetadata: {
        ...(typeof change.resultMetadata === 'object' && change.resultMetadata ? change.resultMetadata : {}),
        routed: 'WEBXXL_REVIEW',
        executed: false,
      },
    },
  })

  await writeProjectActivity({
    projectId: project.id,
    actorUserId: input.actorUserId,
    eventType: 'CHANGE_REQUEST_SUBMITTED',
    summary: formatActivitySummary('CHANGE_REQUEST_SUBMITTED', `${site.domain}: content update`),
  })

  return { ok: true, applied: false, status: 'ESCALATED', changeId: change.id, changeRequestId: changeRequest.id }
}

export async function discardManagedSiteAiDraft(input: {
  actorUserId: string
  customerAccountId: string
  changeId: string
}): Promise<SiteMutationResult> {
  const change = await prisma.managedSiteChange.findUnique({
    where: { id: input.changeId },
    include: { managedSite: true },
  })
  if (!change || change.managedSite.customerAccountId !== input.customerAccountId) {
    return { ok: false, error: 'not_found', applied: false }
  }
  if (change.requestedById !== input.actorUserId) return { ok: false, error: 'unauthorized', applied: false }
  if (change.capabilityKey !== AI_CONTENT_CAPABILITY || change.executionMode !== 'AI_ASSISTED') {
    return { ok: false, error: 'invalid', applied: false }
  }
  if (change.status !== 'DRAFT') return { ok: false, error: 'invalid_status', applied: false }

  await prisma.managedSiteChange.update({
    where: { id: change.id },
    data: { status: 'CANCELLED' },
  })
  return { ok: true, applied: false, status: 'CANCELLED', changeId: change.id }
}

export async function submitContentEditDirectToWebxxl(input: {
  actorUserId: string
  site: SiteSnapshot
  assignments: CapabilityAssignment[]
  requestText: string
}): Promise<SiteMutationResult> {
  const requestText = input.requestText.trim()
  if (!requestText) return { ok: false, error: 'empty', applied: false }
  if (requestText.length > 5000) return { ok: false, error: 'too_long', applied: false }
  if (!input.site.projectId) return { ok: false, error: 'project_required', applied: false }

  const assignment = siteAssignments(input.assignments).find((item) => item.capabilityKey === AI_CONTENT_CAPABILITY) ?? null
  const decision = routeManagedSiteRequest({
    capabilityKey: AI_CONTENT_CAPABILITY,
    assignment,
    actor: 'customer',
  })
  if (!decision.capability || decision.mode !== 'AI_ASSISTED') {
    return { ok: false, error: 'unavailable', applied: false }
  }

  const project = await prisma.project.findFirst({
    where: { id: input.site.projectId, customerAccountId: input.site.customerAccountId },
  })
  if (!project) return { ok: false, error: 'project_required', applied: false }

  const definition = getCapabilityDefinition(AI_CONTENT_CAPABILITY)
  const changeRequest = await prisma.changeRequest.create({
    data: {
      projectId: project.id,
      submittedById: input.actorUserId,
      managedSiteId: input.site.id,
      title: `${input.site.name}: ${definition?.label.en ?? 'Content update'}`,
      description: requestText,
    },
  })

  const change = await prisma.managedSiteChange.create({
    data: {
      managedSiteId: input.site.id,
      requestedById: input.actorUserId,
      capabilityKey: AI_CONTENT_CAPABILITY,
      executionMode: 'AI_ASSISTED',
      status: 'ESCALATED',
      requestText,
      changeRequestId: changeRequest.id,
      resultMetadata: { routed: 'WEBXXL_REVIEW', aiUsed: false, executed: false },
    },
  })

  await writeProjectActivity({
    projectId: project.id,
    actorUserId: input.actorUserId,
    eventType: 'CHANGE_REQUEST_SUBMITTED',
    summary: formatActivitySummary('CHANGE_REQUEST_SUBMITTED', `${input.site.domain}: content update`),
  })

  return { ok: true, applied: false, status: 'ESCALATED', changeId: change.id, changeRequestId: changeRequest.id }
}

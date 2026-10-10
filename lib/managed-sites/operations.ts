import { prisma } from '@/lib/db'
import { formatActivitySummary, writeProjectActivity } from '@/lib/portal/activity'
import { getManagedSiteAdapter, type ManagedSiteContext } from '@/lib/managed-sites/adapters'
import { getCapabilityDefinition, type CapabilityAssignment } from '@/lib/managed-sites/capabilities'
import { transformManagedSiteRequest } from '@/lib/managed-sites/ai'
import {
  isPublicHttpUrl,
  normalizeDomain,
  parseAdapterKey,
  parseEnumValue,
  parseExecutionMode,
  CONNECTION_TYPES,
  SITE_PLATFORMS,
  SITE_STATUSES,
  type AdapterKey,
} from '@/lib/managed-sites/domain'
import { routeManagedSiteRequest } from '@/lib/managed-sites/routing'
import type {
  CapabilityExecutionMode,
  ManagedSiteChangeStatus,
  ManagedSiteConnectionType,
  ManagedSitePlatform,
  ManagedSiteStatus,
  UserRole,
} from '@prisma/client'

export type SiteMutationResult =
  | { ok: true; applied: boolean; status: ManagedSiteChangeStatus; changeId?: string; changeRequestId?: string }
  | { ok: false; error: string; applied: false; status?: ManagedSiteChangeStatus }

type SiteSnapshot = {
  id: string
  name: string
  domain: string
  projectId: string | null
  customerAccountId: string
  adapterKey: string
  connectionType: ManagedSiteConnectionType
  connectionRef: string | null
}

export async function submitManagedSiteChange(input: {
  actorUserId: string
  actor: 'customer' | 'staff'
  site: SiteSnapshot
  assignments: CapabilityAssignment[]
  capabilityKey: string
  requestText: string
  clientExecutionMode?: unknown
}): Promise<SiteMutationResult> {
  const requestText = input.requestText.trim()
  if (!requestText) return { ok: false, error: 'empty', applied: false }
  if (requestText.length > 5000) return { ok: false, error: 'too_long', applied: false }

  const assignment = input.assignments.find((item) => item.capabilityKey === input.capabilityKey) ?? null
  const decision = routeManagedSiteRequest({
    capabilityKey: input.capabilityKey,
    assignment,
    actor: input.actor,
    clientExecutionMode: input.clientExecutionMode,
  })
  if (!decision.capability || decision.mode === 'UNAVAILABLE') {
    return { ok: false, error: decision.reason === 'unknown' ? 'unknown' : decision.reason, applied: false }
  }
  if (decision.mode === 'READ_ONLY') return { ok: false, error: 'read_only', applied: false }

  const executionMode: CapabilityExecutionMode = decision.capability.executionMode
  const definition = getCapabilityDefinition(input.capabilityKey)
  const label = definition?.label.en ?? input.capabilityKey

  if (decision.mode === 'HUMAN_REQUIRED') {
    if (!input.site.projectId) return { ok: false, error: 'project_required', applied: false }
    const project = await prisma.project.findFirst({
      where: { id: input.site.projectId, customerAccountId: input.site.customerAccountId },
    })
    if (!project) return { ok: false, error: 'project_required', applied: false }
    const changeRequest = await prisma.changeRequest.create({
      data: {
        projectId: project.id,
        submittedById: input.actorUserId,
        managedSiteId: input.site.id,
        title: `${input.site.name}: ${label}`,
        description: requestText,
      },
    })
    const change = await prisma.managedSiteChange.create({
      data: {
        managedSiteId: input.site.id,
        requestedById: input.actorUserId,
        capabilityKey: input.capabilityKey,
        executionMode,
        status: 'ESCALATED',
        requestText,
        changeRequestId: changeRequest.id,
        resultMetadata: { routed: 'HUMAN_REQUIRED' },
      },
    })
    await writeProjectActivity({
      projectId: project.id,
      actorUserId: input.actorUserId,
      eventType: 'CHANGE_REQUEST_SUBMITTED',
      summary: formatActivitySummary('CHANGE_REQUEST_SUBMITTED', `${input.site.domain}: ${label}`),
    })
    return { ok: true, applied: false, status: 'ESCALATED', changeId: change.id, changeRequestId: changeRequest.id }
  }

  if (decision.mode === 'AI_ASSISTED') {
    const ai = transformManagedSiteRequest({ capabilityKey: input.capabilityKey, requestText })
    const change = await prisma.managedSiteChange.create({
      data: {
        managedSiteId: input.site.id,
        requestedById: input.actorUserId,
        capabilityKey: input.capabilityKey,
        executionMode,
        status: 'DRAFT',
        requestText,
        resultMetadata: { ai: ai.reason, executed: false },
      },
    })
    return { ok: true, applied: false, status: change.status, changeId: change.id }
  }

  if (decision.capability.requiresApproval || definition?.editorFields.length === 0) {
    const change = await prisma.managedSiteChange.create({
      data: {
        managedSiteId: input.site.id,
        requestedById: input.actorUserId,
        capabilityKey: input.capabilityKey,
        executionMode,
        status: 'AWAITING_APPROVAL',
        requestText,
        resultMetadata: { executed: false },
      },
    })
    return { ok: true, applied: false, status: 'AWAITING_APPROVAL', changeId: change.id }
  }

  const applied = await getManagedSiteAdapter(input.site.adapterKey).applyChange(siteContext(input.site), input.capabilityKey, null)
  const change = await prisma.managedSiteChange.create({
    data: {
      managedSiteId: input.site.id,
      requestedById: input.actorUserId,
      capabilityKey: input.capabilityKey,
      executionMode,
      status: applied.ok ? 'APPLIED' : 'FAILED',
      requestText,
      appliedAt: applied.ok ? new Date() : null,
      resultMetadata: applied.ok ? { executed: true } : { executed: false, reason: applied.reason },
    },
  })
  if (!applied.ok) return { ok: false, error: applied.reason, applied: false, status: 'FAILED' }
  return { ok: true, applied: true, status: 'APPLIED', changeId: change.id }
}

export async function approveManagedSiteChange(input: {
  actorUserId: string
  change: {
    id: string
    status: ManagedSiteChangeStatus
    capabilityKey: string
    managedSiteId: string
  }
  site: SiteSnapshot
}): Promise<SiteMutationResult> {
  if (input.change.status !== 'AWAITING_APPROVAL') {
    return { ok: false, error: 'not_awaiting_approval', applied: false, status: input.change.status }
  }
  if (input.change.managedSiteId !== input.site.id) return { ok: false, error: 'not_found', applied: false }

  const applied = await getManagedSiteAdapter(input.site.adapterKey).applyChange(siteContext(input.site), input.change.capabilityKey, null)
  if (!applied.ok) {
    await prisma.managedSiteChange.update({
      where: { id: input.change.id },
      data: {
        status: 'APPROVED',
        approvedById: input.actorUserId,
        approvedAt: new Date(),
        appliedAt: null,
        resultMetadata: { executed: false, reason: applied.reason },
      },
    })
    return { ok: false, error: applied.reason, applied: false, status: 'APPROVED' }
  }

  await prisma.managedSiteChange.update({
    where: { id: input.change.id },
    data: {
      status: 'APPLIED',
      approvedById: input.actorUserId,
      approvedAt: new Date(),
      appliedAt: new Date(),
      resultMetadata: { executed: true },
    },
  })
  return { ok: true, applied: true, status: 'APPLIED' }
}

export async function registerManagedSite(input: {
  actorRole: UserRole
  customerAccountId: string
  projectId?: string | null
  name: string
  domain: string
  canonicalUrl: string
  status?: string
  platform?: string
  locale?: string
  connectionType?: string
  adapterKey?: string
  externalAdminUrl?: string | null
}): Promise<{ ok: true; siteId: string } | { ok: false; error: string }> {
  const name = input.name.trim()
  const domain = normalizeDomain(input.domain)
  if (!name || !domain) return { ok: false, error: 'invalid' }
  if (!isPublicHttpUrl(input.canonicalUrl)) return { ok: false, error: 'invalid_url' }
  const externalAdminUrl = optionalUrl(input.externalAdminUrl)
  if (externalAdminUrl === 'invalid') return { ok: false, error: 'invalid_url' }

  const account = await prisma.customerAccount.findUnique({ where: { id: input.customerAccountId } })
  if (!account) return { ok: false, error: 'not_found' }
  const projectId = await resolveProject(input.projectId, input.customerAccountId)
  if (projectId === 'invalid') return { ok: false, error: 'invalid_project' }

  const existing = await prisma.managedSite.findUnique({ where: { domain } })
  if (existing) return { ok: false, error: 'duplicate_domain' }

  const connection = resolveConnection(input.actorRole, input.adapterKey, input.connectionType)
  if (!connection.ok) return connection

  const status = parseEnumValue(input.status ?? 'SETUP', SITE_STATUSES) ?? null
  const platform = parseEnumValue(input.platform ?? 'OTHER', SITE_PLATFORMS) ?? null
  if (!status || !platform) return { ok: false, error: 'invalid' }

  const site = await prisma.managedSite.create({
    data: {
      customerAccountId: input.customerAccountId,
      projectId,
      name,
      domain,
      canonicalUrl: input.canonicalUrl.trim(),
      status,
      platform,
      locale: (input.locale ?? 'en').trim() || 'en',
      connectionType: connection.connectionType,
      adapterKey: connection.adapterKey,
      externalAdminUrl,
    },
  })
  return { ok: true, siteId: site.id }
}

export async function updateManagedSiteProfile(input: {
  siteId: string
  name?: string
  status?: string
  platform?: string
  projectId?: string | null
  customerAccountId: string
  externalAdminUrl?: string | null
  canonicalUrl?: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const data: {
    name?: string
    status?: ManagedSiteStatus
    platform?: ManagedSitePlatform
    projectId?: string | null
    externalAdminUrl?: string | null
    canonicalUrl?: string
  } = {}
  if (input.name !== undefined) {
    const name = input.name.trim()
    if (!name) return { ok: false, error: 'invalid' }
    data.name = name
  }
  if (input.status !== undefined) {
    const status = parseEnumValue(input.status, SITE_STATUSES)
    if (!status) return { ok: false, error: 'invalid' }
    data.status = status
  }
  if (input.platform !== undefined) {
    const platform = parseEnumValue(input.platform, SITE_PLATFORMS)
    if (!platform) return { ok: false, error: 'invalid' }
    data.platform = platform
  }
  if (input.canonicalUrl !== undefined) {
    if (!isPublicHttpUrl(input.canonicalUrl)) return { ok: false, error: 'invalid_url' }
    data.canonicalUrl = input.canonicalUrl.trim()
  }
  if (input.externalAdminUrl !== undefined) {
    const url = optionalUrl(input.externalAdminUrl)
    if (url === 'invalid') return { ok: false, error: 'invalid_url' }
    data.externalAdminUrl = url
  }
  if (input.projectId !== undefined) {
    const projectId = await resolveProject(input.projectId, input.customerAccountId)
    if (projectId === 'invalid') return { ok: false, error: 'invalid_project' }
    data.projectId = projectId
  }
  await prisma.managedSite.update({ where: { id: input.siteId }, data })
  return { ok: true }
}

export async function updateManagedSiteConnection(input: {
  siteId: string
  adapterKey: string
  connectionType: string
  connectionRef?: string | null
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const adapterKey = parseAdapterKey(input.adapterKey)
  const connectionType = parseEnumValue(input.connectionType, CONNECTION_TYPES)
  if (!adapterKey || !connectionType) return { ok: false, error: 'invalid' }
  const connectionRef = input.connectionRef?.trim() || null
  if (connectionRef && connectionRef.length > 120) return { ok: false, error: 'invalid' }
  await prisma.managedSite.update({
    where: { id: input.siteId },
    data: { adapterKey, connectionType, connectionRef },
  })
  return { ok: true }
}

export async function setManagedSiteCapability(input: {
  siteId: string
  capabilityKey: string
  enabled: boolean
  executionMode?: string | null
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!getCapabilityDefinition(input.capabilityKey)) return { ok: false, error: 'unknown' }
  let executionMode: CapabilityExecutionMode | null = null
  if (input.executionMode) {
    executionMode = parseExecutionMode(input.executionMode)
    if (!executionMode) return { ok: false, error: 'invalid' }
  }
  await prisma.managedSiteCapability.upsert({
    where: { managedSiteId_capabilityKey: { managedSiteId: input.siteId, capabilityKey: input.capabilityKey } },
    create: { managedSiteId: input.siteId, capabilityKey: input.capabilityKey, enabled: input.enabled, executionMode },
    update: { enabled: input.enabled, executionMode },
  })
  return { ok: true }
}

function siteContext(site: SiteSnapshot): ManagedSiteContext {
  return {
    id: site.id,
    domain: site.domain,
    adapterKey: site.adapterKey,
    connectionType: site.connectionType,
    connectionRef: site.connectionRef,
  }
}

function resolveConnection(
  actorRole: UserRole,
  adapterKey: string | undefined,
  connectionType: string | undefined,
): { ok: true; adapterKey: AdapterKey; connectionType: ManagedSiteConnectionType } | { ok: false; error: string } {
  const requestedAdapter = adapterKey ? parseAdapterKey(adapterKey) : 'manual'
  const requestedConnection = connectionType ? parseEnumValue(connectionType, CONNECTION_TYPES) : 'MANUAL'
  if (!requestedAdapter || !requestedConnection) return { ok: false, error: 'invalid' }
  if (actorRole !== 'ADMIN' && (requestedAdapter !== 'manual' || requestedConnection !== 'MANUAL')) {
    return { ok: false, error: 'unauthorized' }
  }
  return { ok: true, adapterKey: requestedAdapter, connectionType: requestedConnection }
}

async function resolveProject(projectId: string | null | undefined, customerAccountId: string): Promise<string | null | 'invalid'> {
  if (!projectId) return null
  const project = await prisma.project.findFirst({ where: { id: projectId, customerAccountId } })
  if (!project) return 'invalid'
  return project.id
}

function optionalUrl(value: string | null | undefined): string | null | 'invalid' {
  if (value == null || value.trim() === '') return null
  return isPublicHttpUrl(value.trim()) ? value.trim() : 'invalid'
}

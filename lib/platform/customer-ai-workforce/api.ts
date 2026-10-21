import {
  customerAiDefaultEntitlementKey,
  customerAiUsagePeriodKey,
  isCustomerAiWorkforceEnabled,
} from '@/config/customer-ai-workforce'
import type { PageParams, PageResult } from '@/lib/platform/commerce/pagination'
import { pageResult } from '@/lib/platform/commerce/pagination'
import {
  customerAiFeatureFlagsDto,
  type CustomerAiChatMessageDto,
  type CustomerAiChatSessionDto,
  type CustomerAiEmployeeDto,
  type CustomerAiHandoffDto,
  type CustomerAiKnowledgeItemDto,
  type CustomerAiToolPermissionDto,
  type CustomerAiUsagePolicyDto,
  type CustomerAiUsageSummaryDto,
} from '@/lib/platform/customer-ai-workforce/dto'
import { hasActiveAiEmployeeEntitlement } from '@/lib/platform/customer-ai-workforce/entitlement'
import { authorizeCustomerAiToolCall } from '@/lib/platform/customer-ai-workforce/execution-gateway'
import { nextCustomerAiPublicId } from '@/lib/platform/customer-ai-workforce/ids'
import { canTransitionEmployeeStatus } from '@/lib/platform/customer-ai-workforce/lifecycle'
import { buildRetrievalResult } from '@/lib/platform/customer-ai-workforce/retrieval-contract'
import type { CustomerAiStore, EmployeeRecord } from '@/lib/platform/customer-ai-workforce/store'
import { listCustomerAiToolCatalog } from '@/lib/platform/customer-ai-workforce/tool-catalog'
import type { CustomerAiActor, CustomerAiResult, EmployeeLifecycleStatus, ToolAccessMode } from '@/lib/platform/customer-ai-workforce/types'

function disabled<T>(): CustomerAiResult<T> {
  return { ok: false, error: 'AI_WORKFORCE_DISABLED', message: 'Customer AI workforce disabled' }
}

async function assertAccountAccess(
  store: CustomerAiStore,
  actor: CustomerAiActor,
  customerAccountId: string,
): Promise<CustomerAiResult<true>> {
  if (store.isStaff(actor.userId, actor.platformRole)) return { ok: true, value: true }
  if (await store.hasOperatingMembership(actor.userId, customerAccountId)) return { ok: true, value: true }
  return { ok: false, error: 'FORBIDDEN', message: 'Operating membership required' }
}

function toEmployeeDto(row: EmployeeRecord): CustomerAiEmployeeDto {
  return {
    id: row.id,
    publicId: row.publicId,
    customerAccountId: row.customerAccountId,
    managedSiteId: row.managedSiteId,
    projectId: row.projectId,
    displayName: row.displayName,
    roleTitle: row.roleTitle,
    description: row.description,
    config: row.configJson,
    primaryLocale: row.primaryLocale,
    secondaryLocales: row.secondaryLocales,
    status: row.status,
    entitlementKey: row.entitlementKey,
    emergencyPaused: row.emergencyPaused,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    archivedAt: row.archivedAt?.toISOString() ?? null,
  }
}

export async function listCustomerAiEmployees(
  store: CustomerAiStore,
  actor: CustomerAiActor,
  customerAccountId: string,
  page: PageParams,
): Promise<CustomerAiResult<PageResult<CustomerAiEmployeeDto>>> {
  if (!isCustomerAiWorkforceEnabled()) return disabled()
  const access = await assertAccountAccess(store, actor, customerAccountId)
  if (!access.ok) return access
  const { rows, total } = await store.listEmployees(customerAccountId, page.skip, page.take)
  return { ok: true, value: pageResult(rows.map(toEmployeeDto), total, page) }
}

export async function getCustomerAiEmployee(
  store: CustomerAiStore,
  actor: CustomerAiActor,
  customerAccountId: string,
  employeeId: string,
): Promise<CustomerAiResult<CustomerAiEmployeeDto>> {
  if (!isCustomerAiWorkforceEnabled()) return disabled()
  const access = await assertAccountAccess(store, actor, customerAccountId)
  if (!access.ok) return access
  const row = await store.findEmployeeById(employeeId)
  if (!row || row.customerAccountId !== customerAccountId) return { ok: false, error: 'NOT_FOUND' }
  return { ok: true, value: toEmployeeDto(row) }
}

export async function createCustomerAiEmployee(
  store: CustomerAiStore,
  actor: CustomerAiActor,
  input: {
    customerAccountId: string
    displayName: string
    roleTitle: string
    description?: string | null
    managedSiteId?: string | null
    projectId?: string | null
    primaryLocale?: string
    secondaryLocales?: string[]
    config?: Record<string, unknown>
  },
): Promise<CustomerAiResult<CustomerAiEmployeeDto>> {
  if (!isCustomerAiWorkforceEnabled()) return disabled()
  const access = await assertAccountAccess(store, actor, input.customerAccountId)
  if (!access.ok) return access
  if (!input.displayName.trim() || !input.roleTitle.trim()) {
    return { ok: false, error: 'VALIDATION', message: 'displayName and roleTitle required' }
  }
  const row = await store.createEmployee({
    publicId: nextCustomerAiPublicId('wae'),
    customerAccountId: input.customerAccountId,
    managedSiteId: input.managedSiteId ?? null,
    projectId: input.projectId ?? null,
    displayName: input.displayName.trim(),
    roleTitle: input.roleTitle.trim(),
    description: input.description?.trim() ?? null,
    configJson: input.config ?? {},
    primaryLocale: input.primaryLocale ?? 'en',
    secondaryLocales: input.secondaryLocales ?? [],
    status: 'DRAFT',
    entitlementKey: customerAiDefaultEntitlementKey(),
    emergencyPaused: false,
    createdByUserId: actor.userId,
    updatedByUserId: actor.userId,
  })
  await store.appendEmployeeAudit({
    employeeId: row.id,
    customerAccountId: row.customerAccountId,
    action: 'CREATED',
    fromStatus: null,
    toStatus: 'DRAFT',
    actorUserId: actor.userId,
  })
  return { ok: true, value: toEmployeeDto(row) }
}

export async function updateCustomerAiEmployee(
  store: CustomerAiStore,
  actor: CustomerAiActor,
  customerAccountId: string,
  employeeId: string,
  patch: {
    displayName?: string
    roleTitle?: string
    description?: string | null
    managedSiteId?: string | null
    projectId?: string | null
    primaryLocale?: string
    secondaryLocales?: string[]
    config?: Record<string, unknown>
    emergencyPaused?: boolean
  },
): Promise<CustomerAiResult<CustomerAiEmployeeDto>> {
  if (!isCustomerAiWorkforceEnabled()) return disabled()
  const access = await assertAccountAccess(store, actor, customerAccountId)
  if (!access.ok) return access
  const existing = await store.findEmployeeById(employeeId)
  if (!existing || existing.customerAccountId !== customerAccountId) return { ok: false, error: 'NOT_FOUND' }
  if (existing.status === 'ARCHIVED') return { ok: false, error: 'INVALID_TRANSITION', message: 'Archived employee' }
  const row = await store.updateEmployee(employeeId, {
    displayName: patch.displayName?.trim() ?? existing.displayName,
    roleTitle: patch.roleTitle?.trim() ?? existing.roleTitle,
    description: patch.description !== undefined ? patch.description : existing.description,
    managedSiteId: patch.managedSiteId !== undefined ? patch.managedSiteId : existing.managedSiteId,
    projectId: patch.projectId !== undefined ? patch.projectId : existing.projectId,
    primaryLocale: patch.primaryLocale ?? existing.primaryLocale,
    secondaryLocales: patch.secondaryLocales ?? existing.secondaryLocales,
    configJson: patch.config ?? existing.configJson,
    emergencyPaused: patch.emergencyPaused ?? existing.emergencyPaused,
    updatedByUserId: actor.userId,
  })
  await store.appendEmployeeAudit({
    employeeId,
    customerAccountId,
    action: 'UPDATED',
    fromStatus: existing.status,
    toStatus: row.status,
    actorUserId: actor.userId,
    metadata: { emergencyPaused: row.emergencyPaused },
  })
  return { ok: true, value: toEmployeeDto(row) }
}

export async function transitionCustomerAiEmployee(
  store: CustomerAiStore,
  actor: CustomerAiActor,
  customerAccountId: string,
  employeeId: string,
  toStatus: EmployeeLifecycleStatus,
): Promise<CustomerAiResult<CustomerAiEmployeeDto>> {
  if (!isCustomerAiWorkforceEnabled()) return disabled()
  const access = await assertAccountAccess(store, actor, customerAccountId)
  if (!access.ok) return access
  const existing = await store.findEmployeeById(employeeId)
  if (!existing || existing.customerAccountId !== customerAccountId) return { ok: false, error: 'NOT_FOUND' }
  if (!canTransitionEmployeeStatus(existing.status, toStatus)) {
    return { ok: false, error: 'INVALID_TRANSITION', message: `${existing.status} -> ${toStatus}` }
  }
  if (toStatus === 'ACTIVE') {
    const entitled = await hasActiveAiEmployeeEntitlement(store, customerAccountId, existing.entitlementKey)
    if (!entitled && !store.isStaff(actor.userId, actor.platformRole)) {
      return { ok: false, error: 'ENTITLEMENT_UNRESOLVED', message: 'Paid AI employee entitlement not active' }
    }
    const policy = await store.getUsagePolicy(customerAccountId)
    if (policy?.emergencyDisabled) return { ok: false, error: 'EMERGENCY_DISABLED' }
    const activeCount = await store.countEmployees(customerAccountId, 'ACTIVE')
    const max = policy?.maxActiveEmployees ?? 0
    if (activeCount >= max && existing.status !== 'ACTIVE') {
      return { ok: false, error: 'ENTITLEMENT_UNRESOLVED', message: 'Active employee limit reached' }
    }
  }
  const archivedAt = toStatus === 'ARCHIVED' ? new Date() : existing.archivedAt
  const row = await store.updateEmployee(employeeId, {
    status: toStatus,
    archivedAt,
    updatedByUserId: actor.userId,
  })
  await store.appendEmployeeAudit({
    employeeId,
    customerAccountId,
    action: 'LIFECYCLE',
    fromStatus: existing.status,
    toStatus,
    actorUserId: actor.userId,
  })
  return { ok: true, value: toEmployeeDto(row) }
}

export async function listCustomerAiKnowledge(
  store: CustomerAiStore,
  actor: CustomerAiActor,
  customerAccountId: string,
  page: PageParams,
): Promise<CustomerAiResult<PageResult<CustomerAiKnowledgeItemDto>>> {
  if (!isCustomerAiWorkforceEnabled()) return disabled()
  const access = await assertAccountAccess(store, actor, customerAccountId)
  if (!access.ok) return access
  const { rows, total } = await store.listKnowledge(customerAccountId, page.skip, page.take)
  const items = rows.map((k) => ({
    id: k.id,
    publicId: k.publicId,
    customerAccountId: k.customerAccountId,
    kind: k.kind,
    status: k.status,
    title: k.title,
    summary: k.summary,
    languageTag: k.languageTag,
    classification: k.classification,
    currentRevisionNumber: k.currentRevisionNumber,
    publishedAt: k.publishedAt?.toISOString() ?? null,
    createdAt: k.createdAt.toISOString(),
    updatedAt: k.updatedAt.toISOString(),
  }))
  return { ok: true, value: pageResult(items, total, page) }
}

export async function upsertCustomerAiKnowledge(
  store: CustomerAiStore,
  actor: CustomerAiActor,
  input: {
    customerAccountId: string
    knowledgeId?: string
    kind: string
    title: string
    summary?: string | null
    languageTag?: string
    classification?: string
    content: Record<string, unknown>
    status?: 'DRAFT' | 'IN_REVIEW'
  },
): Promise<CustomerAiResult<CustomerAiKnowledgeItemDto>> {
  if (!isCustomerAiWorkforceEnabled()) return disabled()
  const access = await assertAccountAccess(store, actor, input.customerAccountId)
  if (!access.ok) return access
  let item =
    input.knowledgeId != null
      ? await store.findKnowledgeById(input.knowledgeId)
      : null
  if (input.knowledgeId && (!item || item.customerAccountId !== input.customerAccountId)) {
    return { ok: false, error: 'NOT_FOUND' }
  }
  if (!item) {
    item = await store.createKnowledge({
      publicId: nextCustomerAiPublicId('wak'),
      customerAccountId: input.customerAccountId,
      kind: input.kind,
      status: input.status ?? 'DRAFT',
      title: input.title.trim(),
      summary: input.summary?.trim() ?? null,
      languageTag: input.languageTag ?? 'en',
      classification: input.classification ?? 'GENERAL_BUSINESS',
      createdByUserId: actor.userId,
    })
  } else if (item.status === 'PUBLISHED' || item.status === 'ARCHIVED') {
    return { ok: false, error: 'INVALID_TRANSITION', message: 'Published/archived knowledge is immutable' }
  } else {
    item = await store.updateKnowledge(item.id, {
      title: input.title.trim(),
      summary: input.summary?.trim() ?? null,
      status: input.status ?? item.status,
    })
  }
  const latest = await store.getLatestRevision(item.id)
  const revisionNumber = (latest?.revisionNumber ?? 0) + 1
  await store.addKnowledgeRevision({
    knowledgeItemId: item.id,
    revisionNumber,
    contentJson: input.content,
    provenanceJson: { source: 'portal_api', actorUserId: actor.userId },
    createdByUserId: actor.userId,
  })
  const refreshed = await store.findKnowledgeById(item.id)
  if (!refreshed) return { ok: false, error: 'NOT_FOUND' }
  return {
    ok: true,
    value: {
      id: refreshed.id,
      publicId: refreshed.publicId,
      customerAccountId: refreshed.customerAccountId,
      kind: refreshed.kind,
      status: refreshed.status,
      title: refreshed.title,
      summary: refreshed.summary,
      languageTag: refreshed.languageTag,
      classification: refreshed.classification,
      currentRevisionNumber: refreshed.currentRevisionNumber,
      publishedAt: refreshed.publishedAt?.toISOString() ?? null,
      createdAt: refreshed.createdAt.toISOString(),
      updatedAt: refreshed.updatedAt.toISOString(),
    },
  }
}

export async function publishCustomerAiKnowledge(
  store: CustomerAiStore,
  actor: CustomerAiActor,
  customerAccountId: string,
  knowledgeId: string,
): Promise<CustomerAiResult<CustomerAiKnowledgeItemDto>> {
  if (!isCustomerAiWorkforceEnabled()) return disabled()
  const access = await assertAccountAccess(store, actor, customerAccountId)
  if (!access.ok) return access
  const item = await store.findKnowledgeById(knowledgeId)
  if (!item || item.customerAccountId !== customerAccountId) return { ok: false, error: 'NOT_FOUND' }
  if (item.status !== 'APPROVED' && item.status !== 'IN_REVIEW') {
    return { ok: false, error: 'INVALID_TRANSITION', message: 'Knowledge must be approved before publish' }
  }
  const latest = await store.getLatestRevision(knowledgeId)
  if (!latest) return { ok: false, error: 'VALIDATION', message: 'Knowledge revision required' }
  const row = await store.updateKnowledge(knowledgeId, {
    status: 'PUBLISHED',
    publishedAt: new Date(),
    approvedByUserId: actor.userId,
  })
  return {
    ok: true,
    value: {
      id: row.id,
      publicId: row.publicId,
      customerAccountId: row.customerAccountId,
      kind: row.kind,
      status: row.status,
      title: row.title,
      summary: row.summary,
      languageTag: row.languageTag,
      classification: row.classification,
      currentRevisionNumber: row.currentRevisionNumber,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    },
  }
}

export async function approveCustomerAiKnowledge(
  store: CustomerAiStore,
  actor: CustomerAiActor,
  customerAccountId: string,
  knowledgeId: string,
): Promise<CustomerAiResult<CustomerAiKnowledgeItemDto>> {
  if (!isCustomerAiWorkforceEnabled()) return disabled()
  const access = await assertAccountAccess(store, actor, customerAccountId)
  if (!access.ok) return access
  const item = await store.findKnowledgeById(knowledgeId)
  if (!item || item.customerAccountId !== customerAccountId) return { ok: false, error: 'NOT_FOUND' }
  if (item.status !== 'IN_REVIEW' && item.status !== 'DRAFT') {
    return { ok: false, error: 'INVALID_TRANSITION' }
  }
  const row = await store.updateKnowledge(knowledgeId, { status: 'APPROVED', approvedByUserId: actor.userId })
  return publishCustomerAiKnowledge(store, actor, customerAccountId, row.id)
}

export async function listCustomerAiToolPermissions(
  store: CustomerAiStore,
  actor: CustomerAiActor,
  customerAccountId: string,
  employeeId: string,
): Promise<CustomerAiResult<{ catalog: typeof listCustomerAiToolCatalog extends () => infer R ? R : never; permissions: CustomerAiToolPermissionDto[] }>> {
  if (!isCustomerAiWorkforceEnabled()) return disabled()
  const access = await assertAccountAccess(store, actor, customerAccountId)
  if (!access.ok) return access
  const employee = await store.findEmployeeById(employeeId)
  if (!employee || employee.customerAccountId !== customerAccountId) return { ok: false, error: 'NOT_FOUND' }
  const permissions = await store.listToolPermissions(employeeId)
  return {
    ok: true,
    value: {
      catalog: listCustomerAiToolCatalog(),
      permissions: permissions.map((p) => ({
        toolKey: p.toolKey,
        accessMode: p.accessMode,
        granted: p.granted,
        grantedAt: p.grantedAt?.toISOString() ?? null,
      })),
    },
  }
}

export async function setCustomerAiToolPermission(
  store: CustomerAiStore,
  actor: CustomerAiActor,
  customerAccountId: string,
  employeeId: string,
  toolKey: string,
  accessMode: ToolAccessMode,
  granted: boolean,
): Promise<CustomerAiResult<CustomerAiToolPermissionDto>> {
  if (!isCustomerAiWorkforceEnabled()) return disabled()
  const access = await assertAccountAccess(store, actor, customerAccountId)
  if (!access.ok) return access
  const employee = await store.findEmployeeById(employeeId)
  if (!employee || employee.customerAccountId !== customerAccountId) return { ok: false, error: 'NOT_FOUND' }
  const tool = listCustomerAiToolCatalog().find((t) => t.toolKey === toolKey)
  if (!tool) return { ok: false, error: 'VALIDATION', message: 'Unknown tool' }
  if (tool.alwaysDeny && granted) return { ok: false, error: 'POLICY_BLOCKED' }
  const row = await store.upsertToolPermission({
    employeeId,
    customerAccountId,
    toolKey,
    accessMode,
    granted,
    grantedByUserId: granted ? actor.userId : null,
    grantedAt: granted ? new Date() : null,
    revokedAt: granted ? null : new Date(),
  })
  return {
    ok: true,
    value: {
      toolKey: row.toolKey,
      accessMode: row.accessMode,
      granted: row.granted,
      grantedAt: row.grantedAt?.toISOString() ?? null,
    },
  }
}

export async function createCustomerAiConversation(
  store: CustomerAiStore,
  actor: CustomerAiActor,
  input: {
    customerAccountId: string
    employeeId?: string | null
    managedSiteId?: string | null
    visitorRef?: string | null
    visitorLocale?: string | null
    dataClassification?: string
  },
): Promise<CustomerAiResult<CustomerAiChatSessionDto>> {
  if (!isCustomerAiWorkforceEnabled()) return disabled()
  const access = await assertAccountAccess(store, actor, input.customerAccountId)
  if (!access.ok) return access
  if (input.employeeId) {
    const employee = await store.findEmployeeById(input.employeeId)
    if (!employee || employee.customerAccountId !== input.customerAccountId) {
      return { ok: false, error: 'TENANT_MISMATCH', message: 'Employee account mismatch' }
    }
  }
  const row = await store.createChatSession({
    publicId: nextCustomerAiPublicId('wacs'),
    customerAccountId: input.customerAccountId,
    employeeId: input.employeeId ?? null,
    managedSiteId: input.managedSiteId ?? null,
    status: 'OPEN',
    visitorRef: input.visitorRef ?? null,
    visitorLocale: input.visitorLocale ?? null,
    dataClassification: input.dataClassification ?? 'GENERAL_BUSINESS',
  })
  await store.appendConversationAudit(row.id, input.customerAccountId, 'SESSION_CREATED', actor.userId, {})
  return {
    ok: true,
    value: {
      id: row.id,
      publicId: row.publicId,
      customerAccountId: row.customerAccountId,
      employeeId: row.employeeId,
      managedSiteId: row.managedSiteId,
      status: row.status,
      visitorRef: row.visitorRef,
      visitorLocale: row.visitorLocale,
      dataClassification: row.dataClassification,
      lastMessageAt: null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    },
  }
}

export async function listCustomerAiConversations(
  store: CustomerAiStore,
  actor: CustomerAiActor,
  customerAccountId: string,
  page: PageParams,
): Promise<CustomerAiResult<PageResult<CustomerAiChatSessionDto>>> {
  if (!isCustomerAiWorkforceEnabled()) return disabled()
  const access = await assertAccountAccess(store, actor, customerAccountId)
  if (!access.ok) return access
  const { rows, total } = await store.listChatSessions(customerAccountId, page.skip, page.take)
  const items = rows.map((s) => ({
    id: s.id,
    publicId: s.publicId,
    customerAccountId: s.customerAccountId,
    employeeId: s.employeeId,
    managedSiteId: s.managedSiteId,
    status: s.status,
    visitorRef: s.visitorRef,
    visitorLocale: s.visitorLocale,
    dataClassification: s.dataClassification,
    lastMessageAt: s.lastMessageAt?.toISOString() ?? null,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  }))
  return { ok: true, value: pageResult(items, total, page) }
}

export async function getCustomerAiConversation(
  store: CustomerAiStore,
  actor: CustomerAiActor,
  customerAccountId: string,
  sessionId: string,
): Promise<CustomerAiResult<{ session: CustomerAiChatSessionDto; handoffs: CustomerAiHandoffDto[] }>> {
  if (!isCustomerAiWorkforceEnabled()) return disabled()
  const access = await assertAccountAccess(store, actor, customerAccountId)
  if (!access.ok) return access
  const session = await store.findChatSessionById(sessionId)
  if (!session || session.customerAccountId !== customerAccountId) return { ok: false, error: 'NOT_FOUND' }
  const handoffRows = await store.listHandoffs(sessionId)
  return {
    ok: true,
    value: {
      session: {
        id: session.id,
        publicId: session.publicId,
        customerAccountId: session.customerAccountId,
        employeeId: session.employeeId,
        managedSiteId: session.managedSiteId,
        status: session.status,
        visitorRef: session.visitorRef,
        visitorLocale: session.visitorLocale,
        dataClassification: session.dataClassification,
        lastMessageAt: session.lastMessageAt?.toISOString() ?? null,
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString(),
      },
      handoffs: handoffRows.map((h) => ({
        id: h.id,
        sessionId: h.sessionId,
        status: h.status,
        reason: h.reason,
        assignedUserId: h.assignedUserId,
        createdAt: h.createdAt.toISOString(),
        updatedAt: h.updatedAt.toISOString(),
      })),
    },
  }
}

export async function ingestCustomerAiMessage(
  store: CustomerAiStore,
  actor: CustomerAiActor,
  input: {
    customerAccountId: string
    sessionId: string
    idempotencyKey: string
    role: 'VISITOR' | 'ASSISTANT' | 'SYSTEM' | 'OPERATOR'
    bodyText: string
    content?: Record<string, unknown>
    ingestionSource?: string
  },
): Promise<CustomerAiResult<CustomerAiChatMessageDto>> {
  if (!isCustomerAiWorkforceEnabled()) return disabled()
  const access = await assertAccountAccess(store, actor, input.customerAccountId)
  if (!access.ok) return access
  const session = await store.findChatSessionById(input.sessionId)
  if (!session || session.customerAccountId !== input.customerAccountId) return { ok: false, error: 'NOT_FOUND' }
  const existing = await store.findMessageByIdempotency(input.sessionId, input.idempotencyKey)
  if (existing) {
    return {
      ok: true,
      value: {
        id: existing.id,
        sessionId: existing.sessionId,
        role: existing.role,
        bodyText: existing.bodyText,
        idempotencyKey: existing.idempotencyKey,
        createdAt: existing.createdAt.toISOString(),
      },
    }
  }
  const policy = await store.getUsagePolicy(input.customerAccountId)
  if (policy?.emergencyDisabled) return { ok: false, error: 'EMERGENCY_DISABLED' }
  const row = await store.createMessage({
    sessionId: input.sessionId,
    customerAccountId: input.customerAccountId,
    idempotencyKey: input.idempotencyKey,
    role: input.role,
    bodyText: input.bodyText,
    contentJson: input.content ?? null,
    ingestionSource: input.ingestionSource ?? 'portal_api',
  })
  await store.incrementMessageIngestion(session.employeeId, input.customerAccountId)
  await store.appendConversationAudit(input.sessionId, input.customerAccountId, 'MESSAGE_INGESTED', actor.userId, {
    idempotencyKey: input.idempotencyKey,
  })
  return {
    ok: true,
    value: {
      id: row.id,
      sessionId: row.sessionId,
      role: row.role,
      bodyText: row.bodyText,
      idempotencyKey: row.idempotencyKey,
      createdAt: row.createdAt.toISOString(),
    },
  }
}

export async function requestCustomerAiHandoff(
  store: CustomerAiStore,
  actor: CustomerAiActor,
  input: { customerAccountId: string; sessionId: string; reason?: string; assignedUserId?: string | null },
): Promise<CustomerAiResult<CustomerAiHandoffDto>> {
  if (!isCustomerAiWorkforceEnabled()) return disabled()
  const access = await assertAccountAccess(store, actor, input.customerAccountId)
  if (!access.ok) return access
  const session = await store.findChatSessionById(input.sessionId)
  if (!session || session.customerAccountId !== input.customerAccountId) return { ok: false, error: 'NOT_FOUND' }
  const row = await store.createHandoff({
    sessionId: input.sessionId,
    customerAccountId: input.customerAccountId,
    status: input.assignedUserId ? 'ASSIGNED' : 'REQUESTED',
    reason: input.reason?.trim() ?? null,
    requestedByUserId: actor.userId,
    assignedUserId: input.assignedUserId ?? null,
    chatwootHandoffRef: null,
  })
  await store.updateChatSession(input.sessionId, { status: 'HANDOFF_PENDING' })
  await store.appendConversationAudit(input.sessionId, input.customerAccountId, 'HANDOFF_REQUESTED', actor.userId, {
    handoffId: row.id,
  })
  return {
    ok: true,
    value: {
      id: row.id,
      sessionId: row.sessionId,
      status: row.status,
      reason: row.reason,
      assignedUserId: row.assignedUserId,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    },
  }
}

export async function getCustomerAiUsagePolicy(
  store: CustomerAiStore,
  actor: CustomerAiActor,
  customerAccountId: string,
): Promise<CustomerAiResult<CustomerAiUsagePolicyDto>> {
  if (!isCustomerAiWorkforceEnabled()) return disabled()
  const access = await assertAccountAccess(store, actor, customerAccountId)
  if (!access.ok) return access
  const policy = await store.getUsagePolicy(customerAccountId)
  const activeEmployeeCount = await store.countEmployees(customerAccountId, 'ACTIVE')
  return {
    ok: true,
    value: {
      customerAccountId,
      maxActiveEmployees: policy?.maxActiveEmployees ?? 0,
      monthlyMessageBudget: policy?.monthlyMessageBudget ?? null,
      monthlyTokenBudget: policy?.monthlyTokenBudget ?? null,
      rateLimitPerMinute: policy?.rateLimitPerMinute ?? 0,
      executionEnabled: policy?.executionEnabled ?? false,
      emergencyDisabled: policy?.emergencyDisabled ?? false,
      activeEmployeeCount,
      flags: customerAiFeatureFlagsDto(),
    },
  }
}

export async function getCustomerAiUsageSummary(
  store: CustomerAiStore,
  actor: CustomerAiActor,
  customerAccountId: string,
): Promise<CustomerAiResult<CustomerAiUsageSummaryDto>> {
  if (!isCustomerAiWorkforceEnabled()) return disabled()
  const access = await assertAccountAccess(store, actor, customerAccountId)
  if (!access.ok) return access
  const periodKey = customerAiUsagePeriodKey()
  const counters = await store.listUsageCounters(customerAccountId, periodKey)
  const employees: CustomerAiUsageSummaryDto['employees'] = []
  for (const counter of counters) {
    const emp = await store.findEmployeeById(counter.employeeId)
    if (!emp) continue
    employees.push({
      employeeId: counter.employeeId,
      publicId: emp.publicId,
      messagesIngested: counter.messagesIngested,
      tokensReserved: counter.tokensReserved,
      toolCallsAuthorized: counter.toolCallsAuthorized,
      toolCallsDenied: counter.toolCallsDenied,
    })
  }
  return { ok: true, value: { customerAccountId, periodKey, employees } }
}

export async function evaluateCustomerAiToolAuthorization(
  store: CustomerAiStore,
  actor: CustomerAiActor,
  input: { customerAccountId: string; employeeId: string; toolKey: string; accessMode: ToolAccessMode },
): Promise<CustomerAiResult<{ allowed: boolean; code?: string }>> {
  if (!isCustomerAiWorkforceEnabled()) return disabled()
  const access = await assertAccountAccess(store, actor, input.customerAccountId)
  if (!access.ok) return access
  const result = await authorizeCustomerAiToolCall(store, input)
  if (!result.ok) return { ok: true, value: { allowed: false, code: result.error } }
  return { ok: true, value: { allowed: true } }
}

export async function getCustomerAiKnowledgeRetrievalContract(
  store: CustomerAiStore,
  actor: CustomerAiActor,
  input: { customerAccountId: string; employeeId?: string | null; locale: string },
) {
  if (!isCustomerAiWorkforceEnabled()) return disabled()
  const access = await assertAccountAccess(store, actor, input.customerAccountId)
  if (!access.ok) return access
  const published = await store.listPublishedKnowledge(input.customerAccountId, input.locale)
  return {
    ok: true as const,
    value: buildRetrievalResult({
      accountId: input.customerAccountId,
      employeeId: input.employeeId ?? null,
      locale: input.locale,
      chunks: published.map((p) => ({
        knowledgePublicId: p.publicId,
        revisionNumber: p.currentRevisionNumber ?? 1,
        kind: p.kind,
        languageTag: p.languageTag,
        title: p.title,
        excerpt: typeof p.latestContent.excerpt === 'string' ? p.latestContent.excerpt : p.summary ?? '',
        classification: p.classification,
        publishedAt: p.publishedAt?.toISOString() ?? null,
      })),
    }),
  }
}

export { authorizeCustomerAiToolCall }

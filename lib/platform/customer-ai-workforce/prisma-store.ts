import { customerAiUsagePeriodKey } from '@/config/customer-ai-workforce'
import { prisma } from '@/lib/db'
import type { Prisma } from '@prisma/client'
import { isStaffRole } from '@/lib/admin/roles'
import type {
  ChatMessageRecord,
  ChatSessionRecord,
  CustomerAiStore,
  EmployeeRecord,
  HandoffRecord,
  KnowledgeRecord,
  KnowledgeRevisionRecord,
  ToolPermissionRecord,
  UsageCounterRecord,
  UsagePolicyRecord,
} from '@/lib/platform/customer-ai-workforce/store'
import type { EmployeeLifecycleStatus, ToolAccessMode } from '@/lib/platform/customer-ai-workforce/types'

function mapEmployee(row: {
  id: string
  publicId: string
  customerAccountId: string
  managedSiteId: string | null
  projectId: string | null
  displayName: string
  roleTitle: string
  description: string | null
  configJson: unknown
  primaryLocale: string
  secondaryLocales: unknown
  status: EmployeeLifecycleStatus
  entitlementKey: string
  emergencyPaused: boolean
  createdByUserId: string | null
  updatedByUserId: string | null
  archivedAt: Date | null
  createdAt: Date
  updatedAt: Date
}): EmployeeRecord {
  return {
    ...row,
    configJson: (row.configJson ?? {}) as Record<string, unknown>,
    secondaryLocales: Array.isArray(row.secondaryLocales) ? (row.secondaryLocales as string[]) : [],
  }
}

export const prismaCustomerAiStore: CustomerAiStore = {
  async hasOperatingMembership(userId, customerAccountId) {
    const row = await prisma.customerMembership.findFirst({ where: { userId, customerAccountId } })
    return !!row
  },
  isStaff(_userId, platformRole) {
    return isStaffRole(platformRole as never)
  },
  async listActiveCustomerServices(customerAccountId) {
    const rows = await prisma.customerService.findMany({ where: { customerAccountId, status: 'ACTIVE' } })
    return rows.map((r) => ({ serviceKey: r.serviceKey, status: r.status }))
  },
  async countEmployees(customerAccountId, status) {
    return prisma.customerAiEmployee.count({
      where: { customerAccountId, ...(status ? { status } : {}) },
    })
  },
  async listEmployees(customerAccountId, skip, take) {
    const where = { customerAccountId }
    const [rows, total] = await Promise.all([
      prisma.customerAiEmployee.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
      prisma.customerAiEmployee.count({ where }),
    ])
    return { rows: rows.map(mapEmployee), total }
  },
  async findEmployeeById(id) {
    const row = await prisma.customerAiEmployee.findUnique({ where: { id } })
    return row ? mapEmployee(row) : null
  },
  async findEmployeeByPublicId(publicId) {
    const row = await prisma.customerAiEmployee.findUnique({ where: { publicId } })
    return row ? mapEmployee(row) : null
  },
  async createEmployee(input) {
    const row = await prisma.customerAiEmployee.create({
      data: {
        publicId: input.publicId,
        customerAccountId: input.customerAccountId,
        managedSiteId: input.managedSiteId,
        projectId: input.projectId,
        displayName: input.displayName,
        roleTitle: input.roleTitle,
        description: input.description,
        configJson: input.configJson as Prisma.InputJsonValue,
        primaryLocale: input.primaryLocale,
        secondaryLocales: input.secondaryLocales as Prisma.InputJsonValue,
        status: input.status,
        entitlementKey: input.entitlementKey,
        emergencyPaused: input.emergencyPaused,
        createdByUserId: input.createdByUserId,
        updatedByUserId: input.updatedByUserId,
      },
    })
    return mapEmployee(row)
  },
  async updateEmployee(id, patch) {
    const row = await prisma.customerAiEmployee.update({
      where: { id },
      data: {
        displayName: patch.displayName,
        roleTitle: patch.roleTitle,
        description: patch.description,
        managedSiteId: patch.managedSiteId,
        projectId: patch.projectId,
        configJson: patch.configJson as Prisma.InputJsonValue | undefined,
        primaryLocale: patch.primaryLocale,
        secondaryLocales: patch.secondaryLocales as Prisma.InputJsonValue | undefined,
        status: patch.status,
        emergencyPaused: patch.emergencyPaused,
        archivedAt: patch.archivedAt,
        updatedByUserId: patch.updatedByUserId,
      },
    })
    return mapEmployee(row)
  },
  async appendEmployeeAudit(input) {
    await prisma.customerAiEmployeeAuditEvent.create({
      data: {
        employeeId: input.employeeId,
        customerAccountId: input.customerAccountId,
        action: input.action,
        fromStatus: input.fromStatus ?? undefined,
        toStatus: input.toStatus ?? undefined,
        actorUserId: input.actorUserId,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
      },
    })
  },
  async listKnowledge(customerAccountId, skip, take) {
    const where = { customerAccountId }
    const [rows, total] = await Promise.all([
      prisma.customerAiKnowledgeItem.findMany({ where, orderBy: { updatedAt: 'desc' }, skip, take }),
      prisma.customerAiKnowledgeItem.count({ where }),
    ])
    return {
      rows: rows.map((k) => ({
        id: k.id,
        publicId: k.publicId,
        customerAccountId: k.customerAccountId,
        kind: k.kind,
        status: k.status,
        title: k.title,
        summary: k.summary,
        languageTag: k.languageTag,
        classification: k.classification,
        currentRevisionNumber: k.currentRevisionId ? null : null,
        publishedAt: k.publishedAt,
        archivedAt: k.archivedAt,
        createdByUserId: k.createdByUserId,
        approvedByUserId: k.approvedByUserId,
        createdAt: k.createdAt,
        updatedAt: k.updatedAt,
      })),
      total,
    }
  },
  async findKnowledgeById(id) {
    const k = await prisma.customerAiKnowledgeItem.findUnique({ where: { id } })
    if (!k) return null
    const latest = await prisma.customerAiKnowledgeRevision.findFirst({
      where: { knowledgeItemId: id },
      orderBy: { revisionNumber: 'desc' },
    })
    return {
      id: k.id,
      publicId: k.publicId,
      customerAccountId: k.customerAccountId,
      kind: k.kind,
      status: k.status,
      title: k.title,
      summary: k.summary,
      languageTag: k.languageTag,
      classification: k.classification,
      currentRevisionNumber: latest?.revisionNumber ?? null,
      publishedAt: k.publishedAt,
      archivedAt: k.archivedAt,
      createdByUserId: k.createdByUserId,
      approvedByUserId: k.approvedByUserId,
      createdAt: k.createdAt,
      updatedAt: k.updatedAt,
    }
  },
  async createKnowledge(input) {
    const k = await prisma.customerAiKnowledgeItem.create({
      data: {
        publicId: input.publicId,
        customerAccountId: input.customerAccountId,
        kind: input.kind as never,
        status: input.status as never,
        title: input.title,
        summary: input.summary,
        languageTag: input.languageTag,
        classification: input.classification as never,
        createdByUserId: input.createdByUserId,
      },
    })
    return (await prismaCustomerAiStore.findKnowledgeById(k.id))!
  },
  async updateKnowledge(id, patch) {
    await prisma.customerAiKnowledgeItem.update({
      where: { id },
      data: {
        title: patch.title,
        summary: patch.summary,
        status: patch.status as never,
        publishedAt: patch.publishedAt,
        approvedByUserId: patch.approvedByUserId,
        archivedAt: patch.archivedAt,
      },
    })
    return (await prismaCustomerAiStore.findKnowledgeById(id))!
  },
  async addKnowledgeRevision(input) {
    const rev = await prisma.customerAiKnowledgeRevision.create({
      data: {
        knowledgeItemId: input.knowledgeItemId,
        revisionNumber: input.revisionNumber,
        contentJson: input.contentJson as Prisma.InputJsonValue,
        provenanceJson: input.provenanceJson as Prisma.InputJsonValue | undefined,
        createdByUserId: input.createdByUserId,
      },
    })
    await prisma.customerAiKnowledgeItem.update({
      where: { id: input.knowledgeItemId },
      data: { currentRevisionId: rev.id },
    })
    return {
      id: rev.id,
      knowledgeItemId: rev.knowledgeItemId,
      revisionNumber: rev.revisionNumber,
      contentJson: rev.contentJson as Record<string, unknown>,
      provenanceJson: (rev.provenanceJson ?? null) as Record<string, unknown> | null,
      createdByUserId: rev.createdByUserId,
      createdAt: rev.createdAt,
    }
  },
  async getLatestRevision(knowledgeItemId) {
    const rev = await prisma.customerAiKnowledgeRevision.findFirst({
      where: { knowledgeItemId },
      orderBy: { revisionNumber: 'desc' },
    })
    if (!rev) return null
    return {
      id: rev.id,
      knowledgeItemId: rev.knowledgeItemId,
      revisionNumber: rev.revisionNumber,
      contentJson: rev.contentJson as Record<string, unknown>,
      provenanceJson: (rev.provenanceJson ?? null) as Record<string, unknown> | null,
      createdByUserId: rev.createdByUserId,
      createdAt: rev.createdAt,
    }
  },
  async listPublishedKnowledge(customerAccountId, languageTag) {
    const rows = await prisma.customerAiKnowledgeItem.findMany({
      where: { customerAccountId, status: 'PUBLISHED', languageTag },
    })
    const out: Array<KnowledgeRecord & { latestContent: Record<string, unknown> }> = []
    for (const k of rows) {
      const latest = await prismaCustomerAiStore.getLatestRevision(k.id)
      out.push({
        id: k.id,
        publicId: k.publicId,
        customerAccountId: k.customerAccountId,
        kind: k.kind,
        status: k.status,
        title: k.title,
        summary: k.summary,
        languageTag: k.languageTag,
        classification: k.classification,
        currentRevisionNumber: latest?.revisionNumber ?? null,
        publishedAt: k.publishedAt,
        archivedAt: k.archivedAt,
        createdByUserId: k.createdByUserId,
        approvedByUserId: k.approvedByUserId,
        createdAt: k.createdAt,
        updatedAt: k.updatedAt,
        latestContent: latest?.contentJson ?? {},
      })
    }
    return out
  },
  async listToolPermissions(employeeId) {
    const rows = await prisma.customerAiEmployeeToolPermission.findMany({ where: { employeeId } })
    return rows.map(mapPermission)
  },
  async findToolPermission(employeeId, toolKey, accessMode) {
    const row = await prisma.customerAiEmployeeToolPermission.findUnique({
      where: { employeeId_toolKey_accessMode: { employeeId, toolKey, accessMode } },
    })
    return row ? mapPermission(row) : null
  },
  async upsertToolPermission(input) {
    const row = await prisma.customerAiEmployeeToolPermission.upsert({
      where: { employeeId_toolKey_accessMode: { employeeId: input.employeeId, toolKey: input.toolKey, accessMode: input.accessMode } },
      create: {
        employeeId: input.employeeId,
        customerAccountId: input.customerAccountId,
        toolKey: input.toolKey,
        accessMode: input.accessMode,
        granted: input.granted,
        grantedByUserId: input.grantedByUserId,
        grantedAt: input.grantedAt,
        revokedAt: input.revokedAt,
      },
      update: {
        granted: input.granted,
        grantedByUserId: input.grantedByUserId,
        grantedAt: input.grantedAt,
        revokedAt: input.revokedAt,
      },
    })
    return mapPermission(row)
  },
  async listChatSessions(customerAccountId, skip, take) {
    const where = { customerAccountId }
    const [rows, total] = await Promise.all([
      prisma.customerAiChatSession.findMany({ where, orderBy: { updatedAt: 'desc' }, skip, take }),
      prisma.customerAiChatSession.count({ where }),
    ])
    return { rows: rows.map(mapSession), total }
  },
  async findChatSessionById(id) {
    const row = await prisma.customerAiChatSession.findUnique({ where: { id } })
    return row ? mapSession(row) : null
  },
  async createChatSession(input) {
    const row = await prisma.customerAiChatSession.create({
      data: {
        publicId: input.publicId,
        customerAccountId: input.customerAccountId,
        employeeId: input.employeeId,
        managedSiteId: input.managedSiteId,
        status: input.status as never,
        visitorRef: input.visitorRef,
        visitorLocale: input.visitorLocale,
        dataClassification: input.dataClassification as never,
      },
    })
    return mapSession(row)
  },
  async updateChatSession(id, patch) {
    const row = await prisma.customerAiChatSession.update({
      where: { id },
      data: {
        status: patch.status as never,
        employeeId: patch.employeeId,
        lastMessageAt: patch.lastMessageAt,
      },
    })
    return mapSession(row)
  },
  async appendConversationAudit(sessionId, customerAccountId, eventType, actorUserId, metadata) {
    await prisma.customerAiConversationAuditEvent.create({
      data: { sessionId, customerAccountId, eventType, actorUserId, metadata: metadata as Prisma.InputJsonValue | undefined },
    })
  },
  async findMessageByIdempotency(sessionId, idempotencyKey) {
    const row = await prisma.customerAiChatMessage.findUnique({
      where: { sessionId_idempotencyKey: { sessionId, idempotencyKey } },
    })
    return row ? mapMessage(row) : null
  },
  async createMessage(input) {
    const row = await prisma.customerAiChatMessage.create({
      data: {
        sessionId: input.sessionId,
        customerAccountId: input.customerAccountId,
        idempotencyKey: input.idempotencyKey,
        role: input.role as never,
        bodyText: input.bodyText,
        contentJson: input.contentJson as Prisma.InputJsonValue | undefined,
        ingestionSource: input.ingestionSource,
      },
    })
    await prisma.customerAiChatSession.update({
      where: { id: input.sessionId },
      data: { lastMessageAt: row.createdAt },
    })
    return mapMessage(row)
  },
  async createHandoff(input) {
    const row = await prisma.customerAiHandoffRequest.create({
      data: {
        sessionId: input.sessionId,
        customerAccountId: input.customerAccountId,
        status: input.status as never,
        reason: input.reason,
        requestedByUserId: input.requestedByUserId,
        assignedUserId: input.assignedUserId,
        chatwootHandoffRef: input.chatwootHandoffRef,
      },
    })
    return mapHandoff(row)
  },
  async updateHandoff(id, patch) {
    const row = await prisma.customerAiHandoffRequest.update({
      where: { id },
      data: {
        status: patch.status as never,
        assignedUserId: patch.assignedUserId,
        resolvedAt: patch.resolvedAt,
      },
    })
    return mapHandoff(row)
  },
  async listHandoffs(sessionId) {
    const rows = await prisma.customerAiHandoffRequest.findMany({ where: { sessionId }, orderBy: { createdAt: 'desc' } })
    return rows.map(mapHandoff)
  },
  async getUsagePolicy(customerAccountId) {
    const row = await prisma.customerAiAccountUsagePolicy.findUnique({ where: { customerAccountId } })
    return row ? mapPolicy(row) : null
  },
  async upsertUsagePolicy(input) {
    const row = await prisma.customerAiAccountUsagePolicy.upsert({
      where: { customerAccountId: input.customerAccountId },
      create: { ...input, updatedAt: new Date() },
      update: { ...input, updatedAt: new Date() },
    })
    return mapPolicy(row)
  },
  async listUsageCounters(customerAccountId, periodKey) {
    const rows = await prisma.customerAiEmployeeUsageCounter.findMany({ where: { customerAccountId, periodKey } })
    return rows.map((r) => ({
      employeeId: r.employeeId,
      customerAccountId: r.customerAccountId,
      periodKey: r.periodKey,
      messagesIngested: r.messagesIngested,
      tokensReserved: r.tokensReserved,
      toolCallsAuthorized: r.toolCallsAuthorized,
      toolCallsDenied: r.toolCallsDenied,
    }))
  },
  async incrementMessageIngestion(employeeId, customerAccountId) {
    if (!employeeId) return
    await bumpCounter(employeeId, customerAccountId, { messagesIngested: 1 })
  },
  async incrementToolAllowance(employeeId, customerAccountId) {
    await bumpCounter(employeeId, customerAccountId, { toolCallsAuthorized: 1 })
  },
  async incrementToolDenial(employeeId, customerAccountId) {
    await bumpCounter(employeeId, customerAccountId, { toolCallsDenied: 1 })
  },
}

function mapPermission(row: {
  id: string
  employeeId: string
  customerAccountId: string
  toolKey: string
  accessMode: ToolAccessMode
  granted: boolean
  grantedByUserId: string | null
  grantedAt: Date | null
  revokedAt: Date | null
}): ToolPermissionRecord {
  return row
}

function mapSession(row: {
  id: string
  publicId: string
  customerAccountId: string
  employeeId: string | null
  managedSiteId: string | null
  status: ChatSessionRecord['status']
  visitorRef: string | null
  visitorLocale: string | null
  dataClassification: string
  lastMessageAt: Date | null
  createdAt: Date
  updatedAt: Date
}): ChatSessionRecord {
  return row
}

function mapMessage(row: {
  id: string
  sessionId: string
  customerAccountId: string
  idempotencyKey: string
  role: string
  bodyText: string
  contentJson: unknown
  ingestionSource: string | null
  createdAt: Date
}): ChatMessageRecord {
  return {
    ...row,
    contentJson: (row.contentJson ?? null) as Record<string, unknown> | null,
  }
}

function mapHandoff(row: {
  id: string
  sessionId: string
  customerAccountId: string
  status: HandoffRecord['status']
  reason: string | null
  requestedByUserId: string | null
  assignedUserId: string | null
  chatwootHandoffRef: string | null
  resolvedAt: Date | null
  createdAt: Date
  updatedAt: Date
}): HandoffRecord {
  return row
}

function mapPolicy(row: {
  customerAccountId: string
  maxActiveEmployees: number
  monthlyMessageBudget: number | null
  monthlyTokenBudget: number | null
  rateLimitPerMinute: number
  executionEnabled: boolean
  emergencyDisabled: boolean
}): UsagePolicyRecord {
  return row
}

async function bumpCounter(
  employeeId: string,
  customerAccountId: string,
  delta: Partial<Pick<UsageCounterRecord, 'messagesIngested' | 'toolCallsAuthorized' | 'toolCallsDenied'>>,
) {
  const periodKey = customerAiUsagePeriodKey()
  await prisma.customerAiEmployeeUsageCounter.upsert({
    where: { employeeId_periodKey: { employeeId, periodKey } },
    create: {
      employeeId,
      customerAccountId,
      periodKey,
      messagesIngested: delta.messagesIngested ?? 0,
      toolCallsAuthorized: delta.toolCallsAuthorized ?? 0,
      toolCallsDenied: delta.toolCallsDenied ?? 0,
      updatedAt: new Date(),
    },
    update: {
      messagesIngested: delta.messagesIngested ? { increment: delta.messagesIngested } : undefined,
      toolCallsAuthorized: delta.toolCallsAuthorized ? { increment: delta.toolCallsAuthorized } : undefined,
      toolCallsDenied: delta.toolCallsDenied ? { increment: delta.toolCallsDenied } : undefined,
      updatedAt: new Date(),
    },
  })
}

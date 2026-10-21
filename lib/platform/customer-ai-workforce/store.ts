import type {
  ChatSessionStatus,
  EmployeeLifecycleStatus,
  HandoffStatus,
  KnowledgeStatus,
  ToolAccessMode,
} from '@/lib/platform/customer-ai-workforce/types'

export type CustomerServiceRow = { serviceKey: string; status: string }

export type EmployeeRecord = {
  id: string
  publicId: string
  customerAccountId: string
  managedSiteId: string | null
  projectId: string | null
  displayName: string
  roleTitle: string
  description: string | null
  configJson: Record<string, unknown>
  primaryLocale: string
  secondaryLocales: string[]
  status: EmployeeLifecycleStatus
  entitlementKey: string
  emergencyPaused: boolean
  createdByUserId: string | null
  updatedByUserId: string | null
  archivedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export type KnowledgeRecord = {
  id: string
  publicId: string
  customerAccountId: string
  kind: string
  status: KnowledgeStatus
  title: string
  summary: string | null
  languageTag: string
  classification: string
  currentRevisionNumber: number | null
  publishedAt: Date | null
  archivedAt: Date | null
  createdByUserId: string | null
  approvedByUserId: string | null
  createdAt: Date
  updatedAt: Date
}

export type KnowledgeRevisionRecord = {
  id: string
  knowledgeItemId: string
  revisionNumber: number
  contentJson: Record<string, unknown>
  provenanceJson: Record<string, unknown> | null
  createdByUserId: string | null
  createdAt: Date
}

export type ToolPermissionRecord = {
  id: string
  employeeId: string
  customerAccountId: string
  toolKey: string
  accessMode: ToolAccessMode
  granted: boolean
  grantedByUserId: string | null
  grantedAt: Date | null
  revokedAt: Date | null
}

export type ChatSessionRecord = {
  id: string
  publicId: string
  customerAccountId: string
  employeeId: string | null
  managedSiteId: string | null
  status: ChatSessionStatus
  visitorRef: string | null
  visitorLocale: string | null
  dataClassification: string
  lastMessageAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export type ChatMessageRecord = {
  id: string
  sessionId: string
  customerAccountId: string
  idempotencyKey: string
  role: string
  bodyText: string
  contentJson: Record<string, unknown> | null
  ingestionSource: string | null
  createdAt: Date
}

export type HandoffRecord = {
  id: string
  sessionId: string
  customerAccountId: string
  status: HandoffStatus
  reason: string | null
  requestedByUserId: string | null
  assignedUserId: string | null
  chatwootHandoffRef: string | null
  resolvedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export type UsagePolicyRecord = {
  customerAccountId: string
  maxActiveEmployees: number
  monthlyMessageBudget: number | null
  monthlyTokenBudget: number | null
  rateLimitPerMinute: number
  executionEnabled: boolean
  emergencyDisabled: boolean
}

export type UsageCounterRecord = {
  employeeId: string
  customerAccountId: string
  periodKey: string
  messagesIngested: number
  tokensReserved: number
  toolCallsAuthorized: number
  toolCallsDenied: number
}

export type CustomerAiStore = {
  hasOperatingMembership(userId: string, customerAccountId: string): Promise<boolean>
  isStaff(userId: string, platformRole: string): boolean
  listActiveCustomerServices(customerAccountId: string): Promise<CustomerServiceRow[]>

  countEmployees(customerAccountId: string, status?: EmployeeLifecycleStatus): Promise<number>
  listEmployees(customerAccountId: string, skip: number, take: number): Promise<{ rows: EmployeeRecord[]; total: number }>
  findEmployeeById(id: string): Promise<EmployeeRecord | null>
  findEmployeeByPublicId(publicId: string): Promise<EmployeeRecord | null>
  createEmployee(input: Omit<EmployeeRecord, 'id' | 'createdAt' | 'updatedAt' | 'archivedAt'>): Promise<EmployeeRecord>
  updateEmployee(id: string, patch: Partial<EmployeeRecord>): Promise<EmployeeRecord>
  appendEmployeeAudit(input: {
    employeeId: string
    customerAccountId: string
    action: string
    fromStatus: EmployeeLifecycleStatus | null
    toStatus: EmployeeLifecycleStatus | null
    actorUserId: string | null
    metadata?: Record<string, unknown>
  }): Promise<void>

  listKnowledge(customerAccountId: string, skip: number, take: number): Promise<{ rows: KnowledgeRecord[]; total: number }>
  findKnowledgeById(id: string): Promise<KnowledgeRecord | null>
  createKnowledge(input: Omit<KnowledgeRecord, 'id' | 'createdAt' | 'updatedAt' | 'archivedAt' | 'currentRevisionNumber' | 'publishedAt' | 'approvedByUserId'>): Promise<KnowledgeRecord>
  updateKnowledge(id: string, patch: Partial<KnowledgeRecord>): Promise<KnowledgeRecord>
  addKnowledgeRevision(input: Omit<KnowledgeRevisionRecord, 'id' | 'createdAt'>): Promise<KnowledgeRevisionRecord>
  getLatestRevision(knowledgeItemId: string): Promise<KnowledgeRevisionRecord | null>
  listPublishedKnowledge(customerAccountId: string, languageTag: string): Promise<Array<KnowledgeRecord & { latestContent: Record<string, unknown> }>>

  listToolPermissions(employeeId: string): Promise<ToolPermissionRecord[]>
  findToolPermission(employeeId: string, toolKey: string, accessMode: ToolAccessMode): Promise<ToolPermissionRecord | null>
  upsertToolPermission(input: Omit<ToolPermissionRecord, 'id'> & { id?: string }): Promise<ToolPermissionRecord>

  listChatSessions(customerAccountId: string, skip: number, take: number): Promise<{ rows: ChatSessionRecord[]; total: number }>
  findChatSessionById(id: string): Promise<ChatSessionRecord | null>
  createChatSession(input: Omit<ChatSessionRecord, 'id' | 'createdAt' | 'updatedAt' | 'lastMessageAt'>): Promise<ChatSessionRecord>
  updateChatSession(id: string, patch: Partial<ChatSessionRecord>): Promise<ChatSessionRecord>
  appendConversationAudit(sessionId: string, customerAccountId: string, eventType: string, actorUserId: string | null, metadata?: Record<string, unknown>): Promise<void>

  findMessageByIdempotency(sessionId: string, idempotencyKey: string): Promise<ChatMessageRecord | null>
  createMessage(input: Omit<ChatMessageRecord, 'id' | 'createdAt'>): Promise<ChatMessageRecord>

  createHandoff(input: Omit<HandoffRecord, 'id' | 'createdAt' | 'updatedAt' | 'resolvedAt'>): Promise<HandoffRecord>
  updateHandoff(id: string, patch: Partial<HandoffRecord>): Promise<HandoffRecord>
  listHandoffs(sessionId: string): Promise<HandoffRecord[]>

  getUsagePolicy(customerAccountId: string): Promise<UsagePolicyRecord | null>
  upsertUsagePolicy(input: UsagePolicyRecord): Promise<UsagePolicyRecord>
  listUsageCounters(customerAccountId: string, periodKey: string): Promise<UsageCounterRecord[]>
  incrementMessageIngestion(employeeId: string | null, customerAccountId: string): Promise<void>
  incrementToolAllowance(employeeId: string, customerAccountId: string): Promise<void>
  incrementToolDenial(employeeId: string, customerAccountId: string): Promise<void>
}

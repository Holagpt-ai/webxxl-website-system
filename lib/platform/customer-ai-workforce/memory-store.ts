import { customerAiUsagePeriodKey } from '@/config/customer-ai-workforce'
import { nextCustomerAiPublicId } from '@/lib/platform/customer-ai-workforce/ids'
import type {
  ChatMessageRecord,
  ChatSessionRecord,
  CustomerAiStore,
  CustomerServiceRow,
  EmployeeRecord,
  HandoffRecord,
  KnowledgeRecord,
  KnowledgeRevisionRecord,
  ToolPermissionRecord,
  UsageCounterRecord,
  UsagePolicyRecord,
} from '@/lib/platform/customer-ai-workforce/store'
import type { EmployeeLifecycleStatus, ToolAccessMode } from '@/lib/platform/customer-ai-workforce/types'

let idSeq = 0
function cid(prefix: string): string {
  idSeq += 1
  return `${prefix}_${idSeq}`
}

export type MemoryCustomerAiSeed = {
  operating: Array<{ userId: string; customerAccountId: string }>
  services?: Array<{ customerAccountId: string; serviceKey: string; status: string }>
  policies?: UsagePolicyRecord[]
}

export function createMemoryCustomerAiStore(seed: MemoryCustomerAiSeed): CustomerAiStore {
  const operating = new Set(seed.operating.map((o) => `${o.userId}|${o.customerAccountId}`))
  const services = seed.services ?? []
  const employees = new Map<string, EmployeeRecord>()
  const knowledge = new Map<string, KnowledgeRecord>()
  const revisions = new Map<string, KnowledgeRevisionRecord>()
  const permissions = new Map<string, ToolPermissionRecord>()
  const sessions = new Map<string, ChatSessionRecord>()
  const messages = new Map<string, ChatMessageRecord>()
  const handoffs = new Map<string, HandoffRecord>()
  const policies = new Map<string, UsagePolicyRecord>()
  const counters = new Map<string, UsageCounterRecord>()

  for (const p of seed.policies ?? []) policies.set(p.customerAccountId, p)

  const counterKey = (employeeId: string, periodKey: string) => `${employeeId}|${periodKey}`

  const store: CustomerAiStore = {
    async hasOperatingMembership(userId, customerAccountId) {
      return operating.has(`${userId}|${customerAccountId}`)
    },
    isStaff(_userId, platformRole) {
      return platformRole === 'ADMIN' || platformRole === 'STAFF'
    },
    async listActiveCustomerServices(customerAccountId) {
      return services.filter((s) => s.customerAccountId === customerAccountId) as CustomerServiceRow[]
    },
    async countEmployees(customerAccountId, status?) {
      return [...employees.values()].filter((e) => e.customerAccountId === customerAccountId && (!status || e.status === status)).length
    },
    async listEmployees(customerAccountId, skip, take) {
      const rows = [...employees.values()]
        .filter((e) => e.customerAccountId === customerAccountId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      return { rows: rows.slice(skip, skip + take), total: rows.length }
    },
    async findEmployeeById(id) {
      return employees.get(id) ?? null
    },
    async findEmployeeByPublicId(publicId) {
      return [...employees.values()].find((e) => e.publicId === publicId) ?? null
    },
    async createEmployee(input) {
      const now = new Date()
      const row: EmployeeRecord = {
        ...input,
        id: cid('emp'),
        archivedAt: null,
        createdAt: now,
        updatedAt: now,
      }
      employees.set(row.id, row)
      return row
    },
    async updateEmployee(id, patch) {
      const prev = employees.get(id)
      if (!prev) throw new Error('missing employee')
      const row = { ...prev, ...patch, updatedAt: new Date() }
      employees.set(id, row)
      return row
    },
    async appendEmployeeAudit() {
      return
    },
    async listKnowledge(customerAccountId, skip, take) {
      const rows = [...knowledge.values()].filter((k) => k.customerAccountId === customerAccountId)
      return { rows: rows.slice(skip, skip + take), total: rows.length }
    },
    async findKnowledgeById(id) {
      return knowledge.get(id) ?? null
    },
    async createKnowledge(input) {
      const now = new Date()
      const row: KnowledgeRecord = {
        ...input,
        id: cid('kn'),
        currentRevisionNumber: null,
        publishedAt: null,
        approvedByUserId: null,
        archivedAt: null,
        createdAt: now,
        updatedAt: now,
      }
      knowledge.set(row.id, row)
      return row
    },
    async updateKnowledge(id, patch) {
      const prev = knowledge.get(id)
      if (!prev) throw new Error('missing knowledge')
      const row = { ...prev, ...patch, updatedAt: new Date() }
      knowledge.set(id, row)
      return row
    },
    async addKnowledgeRevision(input) {
      const row: KnowledgeRevisionRecord = { ...input, id: cid('krev'), createdAt: new Date() }
      revisions.set(row.id, row)
      const item = knowledge.get(input.knowledgeItemId)
      if (item) {
        knowledge.set(item.id, { ...item, currentRevisionNumber: input.revisionNumber, updatedAt: new Date() })
      }
      return row
    },
    async getLatestRevision(knowledgeItemId) {
      const rows = [...revisions.values()].filter((r) => r.knowledgeItemId === knowledgeItemId)
      return rows.sort((a, b) => b.revisionNumber - a.revisionNumber)[0] ?? null
    },
    async listPublishedKnowledge(customerAccountId, languageTag) {
      return [...knowledge.values()]
        .filter((k) => k.customerAccountId === customerAccountId && k.status === 'PUBLISHED' && k.languageTag === languageTag)
        .map((k) => {
          const latest = [...revisions.values()].filter((r) => r.knowledgeItemId === k.id).sort((a, b) => b.revisionNumber - a.revisionNumber)[0]
          return { ...k, latestContent: latest?.contentJson ?? {} }
        })
    },
    async listToolPermissions(employeeId) {
      return [...permissions.values()].filter((p) => p.employeeId === employeeId)
    },
    async findToolPermission(employeeId, toolKey, accessMode) {
      return [...permissions.values()].find((p) => p.employeeId === employeeId && p.toolKey === toolKey && p.accessMode === accessMode) ?? null
    },
    async upsertToolPermission(input) {
      const existing = await store.findToolPermission(input.employeeId, input.toolKey, input.accessMode)
      const row: ToolPermissionRecord = {
        id: existing?.id ?? cid('perm'),
        ...input,
      }
      permissions.set(row.id, row)
      return row
    },
    async listChatSessions(customerAccountId, skip, take) {
      const rows = [...sessions.values()].filter((s) => s.customerAccountId === customerAccountId)
      return { rows: rows.slice(skip, skip + take), total: rows.length }
    },
    async findChatSessionById(id) {
      return sessions.get(id) ?? null
    },
    async createChatSession(input) {
      const now = new Date()
      const row: ChatSessionRecord = { ...input, id: cid('sess'), lastMessageAt: null, createdAt: now, updatedAt: now }
      sessions.set(row.id, row)
      return row
    },
    async updateChatSession(id, patch) {
      const prev = sessions.get(id)
      if (!prev) throw new Error('missing session')
      const row = { ...prev, ...patch, updatedAt: new Date() }
      sessions.set(id, row)
      return row
    },
    async appendConversationAudit() {
      return
    },
    async findMessageByIdempotency(sessionId, idempotencyKey) {
      return [...messages.values()].find((m) => m.sessionId === sessionId && m.idempotencyKey === idempotencyKey) ?? null
    },
    async createMessage(input) {
      const row: ChatMessageRecord = { ...input, id: cid('msg'), createdAt: new Date() }
      messages.set(row.id, row)
      const session = sessions.get(input.sessionId)
      if (session) sessions.set(session.id, { ...session, lastMessageAt: row.createdAt, updatedAt: new Date() })
      return row
    },
    async createHandoff(input) {
      const now = new Date()
      const row: HandoffRecord = { ...input, id: cid('ho'), resolvedAt: null, createdAt: now, updatedAt: now }
      handoffs.set(row.id, row)
      return row
    },
    async updateHandoff(id, patch) {
      const prev = handoffs.get(id)
      if (!prev) throw new Error('missing handoff')
      const row = { ...prev, ...patch, updatedAt: new Date() }
      handoffs.set(id, row)
      return row
    },
    async listHandoffs(sessionId) {
      return [...handoffs.values()].filter((h) => h.sessionId === sessionId)
    },
    async getUsagePolicy(customerAccountId) {
      return policies.get(customerAccountId) ?? null
    },
    async upsertUsagePolicy(input) {
      policies.set(input.customerAccountId, input)
      return input
    },
    async listUsageCounters(customerAccountId, periodKey) {
      return [...counters.values()].filter((c) => c.customerAccountId === customerAccountId && c.periodKey === periodKey)
    },
    async incrementMessageIngestion(employeeId, customerAccountId) {
      if (!employeeId) return
      const periodKey = customerAiUsagePeriodKey()
      const key = counterKey(employeeId, periodKey)
      const prev = counters.get(key) ?? {
        employeeId,
        customerAccountId,
        periodKey,
        messagesIngested: 0,
        tokensReserved: 0,
        toolCallsAuthorized: 0,
        toolCallsDenied: 0,
      }
      counters.set(key, { ...prev, messagesIngested: prev.messagesIngested + 1 })
    },
    async incrementToolAllowance(employeeId, customerAccountId) {
      const periodKey = customerAiUsagePeriodKey()
      const key = counterKey(employeeId, periodKey)
      const prev = counters.get(key) ?? {
        employeeId,
        customerAccountId,
        periodKey,
        messagesIngested: 0,
        tokensReserved: 0,
        toolCallsAuthorized: 0,
        toolCallsDenied: 0,
      }
      counters.set(key, { ...prev, toolCallsAuthorized: prev.toolCallsAuthorized + 1 })
    },
    async incrementTokenReservation(employeeId, customerAccountId, units) {
      const periodKey = customerAiUsagePeriodKey()
      const key = counterKey(employeeId, periodKey)
      const prev = counters.get(key) ?? {
        employeeId,
        customerAccountId,
        periodKey,
        messagesIngested: 0,
        tokensReserved: 0,
        toolCallsAuthorized: 0,
        toolCallsDenied: 0,
      }
      counters.set(key, { ...prev, tokensReserved: prev.tokensReserved + units })
    },
    async incrementToolDenial(employeeId, customerAccountId) {
      const periodKey = customerAiUsagePeriodKey()
      const key = counterKey(employeeId, periodKey)
      const prev = counters.get(key) ?? {
        employeeId,
        customerAccountId,
        periodKey,
        messagesIngested: 0,
        tokensReserved: 0,
        toolCallsAuthorized: 0,
        toolCallsDenied: 0,
      }
      counters.set(key, { ...prev, toolCallsDenied: prev.toolCallsDenied + 1 })
    },
  }

  return store
}

export function memoryCreateEmployeePublicId(): string {
  return nextCustomerAiPublicId('wae')
}

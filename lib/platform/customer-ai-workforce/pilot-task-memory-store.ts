import type {
  CustomerAiPilotApprovalRecord,
  CustomerAiPilotTaskRecord,
} from '@/lib/platform/customer-ai-workforce/pilot-types'
import type {
  PilotTaskPersistence,
  SavePilotApprovalInput,
  SavePilotTaskInput,
  PilotTaskWorkflowPatch,
} from '@/lib/platform/customer-ai-workforce/pilot-task-persistence'
import { pilotWorkflowTransitionAllowed } from '@/lib/platform/customer-ai-workforce/pilot-workflow-transition'

const tasks = new Map<string, CustomerAiPilotTaskRecord>()
const tasksByIdempotency = new Map<string, string>()
const approvals = new Map<string, CustomerAiPilotApprovalRecord>()

let seq = 0

function nextPublicId(prefix: string): string {
  seq += 1
  return `${prefix}_${seq.toString(36)}`
}

export const memoryPilotTaskPersistence: PilotTaskPersistence = {
  resetForTests() {
    tasks.clear()
    tasksByIdempotency.clear()
    approvals.clear()
    seq = 0
  },

  async findPilotTaskByIdempotency(customerAccountId, employeeId, idempotencyKey) {
    const key = `${customerAccountId}:${employeeId}:${idempotencyKey}`
    const id = tasksByIdempotency.get(key)
    if (!id) return null
    return tasks.get(id) ?? null
  },

  async savePilotTask(record: SavePilotTaskInput) {
    const idemKey = `${record.customerAccountId}:${record.employeeId}:${record.idempotencyKey}`
    const existingId = tasksByIdempotency.get(idemKey)
    if (existingId) {
      const existing = tasks.get(existingId)
      if (existing) {
        if (existing.requestFingerprint !== record.requestFingerprint) {
          throw Object.assign(new Error('Idempotency fingerprint conflict'), { code: 'PILOT_IDEMPOTENCY_CONFLICT' })
        }
        return existing
      }
    }
    const id = nextPublicId('pilot_task')
    const full: CustomerAiPilotTaskRecord = {
      ...record,
      id,
      publicId: nextPublicId('pt'),
      createdAt: new Date(),
      workflowSyncState: record.workflowSyncState ?? 'NOT_QUEUED',
      workflowJobId: record.workflowJobId ?? null,
      workflowValidatedAt: record.workflowValidatedAt ?? null,
    }
    tasks.set(id, full)
    tasksByIdempotency.set(`${record.customerAccountId}:${record.employeeId}:${record.idempotencyKey}`, id)
    return full
  },

  async findPilotTaskById(id: string) {
    return tasks.get(id) ?? null
  },

  async updatePilotTaskWorkflow(taskId: string, patch: PilotTaskWorkflowPatch) {
    const existing = tasks.get(taskId)
    if (!existing) return null
    if (!pilotWorkflowTransitionAllowed(existing.workflowSyncState, patch)) {
      return existing
    }
    if (patch.ifCurrentSyncStateIn && !patch.ifCurrentSyncStateIn.includes(existing.workflowSyncState)) {
      return existing
    }
    const next: CustomerAiPilotTaskRecord = {
      ...existing,
      ...(patch.workflowJobId !== undefined ? { workflowJobId: patch.workflowJobId } : {}),
      ...(patch.workflowSyncState !== undefined ? { workflowSyncState: patch.workflowSyncState } : {}),
      ...(patch.workflowValidatedAt !== undefined ? { workflowValidatedAt: patch.workflowValidatedAt } : {}),
      ...(patch.blockedReason !== undefined ? { blockedReason: patch.blockedReason } : {}),
    }
    tasks.set(taskId, next)
    return next
  },

  async savePilotApproval(record: SavePilotApprovalInput) {
    const id = nextPublicId('pilot_approval')
    const full: CustomerAiPilotApprovalRecord = { ...record, id, createdAt: new Date() }
    approvals.set(id, full)
    return full
  },

  async findPilotApprovalById(id: string) {
    return approvals.get(id) ?? null
  },

  async updatePilotApproval(id, patch, options) {
    const existing = approvals.get(id)
    if (!existing) return null
    if (options?.consumeIfUnset && options.customerAccountId && existing.customerAccountId !== options.customerAccountId) {
      return null
    }
    if (options?.consumeIfUnset && existing.consumedAt) return null
    if (options?.consumeIfUnset && existing.revokedAt) return null
    const next = { ...existing, ...patch }
    approvals.set(id, next)
    return next
  },

  async linkPilotTaskApproval(taskId: string, approvalId: string) {
    const task = tasks.get(taskId)
    if (!task) return
    tasks.set(taskId, { ...task, approvalId })
  },
}

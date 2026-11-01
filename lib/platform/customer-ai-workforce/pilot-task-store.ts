import type {
  CustomerAiPilotApprovalRecord,
  CustomerAiPilotTaskRecord,
} from '@/lib/platform/customer-ai-workforce/pilot-types'

const tasks = new Map<string, CustomerAiPilotTaskRecord>()
const tasksByIdempotency = new Map<string, string>()
const approvals = new Map<string, CustomerAiPilotApprovalRecord>()

let seq = 0

function nextPublicId(prefix: string): string {
  seq += 1
  return `${prefix}_${seq.toString(36)}`
}

export function resetCustomerAiPilotTaskStoreForTests(): void {
  tasks.clear()
  tasksByIdempotency.clear()
  approvals.clear()
  seq = 0
}

export function findPilotTaskByIdempotency(
  customerAccountId: string,
  employeeId: string,
  idempotencyKey: string,
): CustomerAiPilotTaskRecord | null {
  const key = `${customerAccountId}:${employeeId}:${idempotencyKey}`
  const id = tasksByIdempotency.get(key)
  if (!id) return null
  return tasks.get(id) ?? null
}

export function savePilotTask(record: Omit<CustomerAiPilotTaskRecord, 'id' | 'publicId' | 'createdAt'>): CustomerAiPilotTaskRecord {
  const id = nextPublicId('pilot_task')
  const full: CustomerAiPilotTaskRecord = {
    ...record,
    id,
    publicId: nextPublicId('pt'),
    createdAt: new Date(),
  }
  tasks.set(id, full)
  tasksByIdempotency.set(`${record.customerAccountId}:${record.employeeId}:${record.idempotencyKey}`, id)
  return full
}

export function findPilotTaskById(id: string): CustomerAiPilotTaskRecord | null {
  return tasks.get(id) ?? null
}

export function savePilotApproval(
  record: Omit<CustomerAiPilotApprovalRecord, 'id' | 'createdAt'>,
): CustomerAiPilotApprovalRecord {
  const id = nextPublicId('pilot_approval')
  const full: CustomerAiPilotApprovalRecord = { ...record, id, createdAt: new Date() }
  approvals.set(id, full)
  return full
}

export function findPilotApprovalById(id: string): CustomerAiPilotApprovalRecord | null {
  return approvals.get(id) ?? null
}

export function updatePilotApproval(id: string, patch: Partial<CustomerAiPilotApprovalRecord>): CustomerAiPilotApprovalRecord | null {
  const existing = approvals.get(id)
  if (!existing) return null
  const next = { ...existing, ...patch }
  approvals.set(id, next)
  return next
}

export function linkPilotTaskApproval(taskId: string, approvalId: string): void {
  const task = tasks.get(taskId)
  if (!task) return
  tasks.set(taskId, { ...task, approvalId })
}

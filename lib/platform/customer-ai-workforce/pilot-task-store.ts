import { isCustomerAiPilotDurableEnabled } from '@/config/customer-ai-workforce'
import { memoryPilotTaskPersistence } from '@/lib/platform/customer-ai-workforce/pilot-task-memory-store'
import { prismaPilotTaskPersistence } from '@/lib/platform/customer-ai-workforce/pilot-task-prisma-store'
import type {
  PilotTaskPersistence,
  PilotTaskWorkflowPatch,
  SavePilotApprovalInput,
  SavePilotTaskInput,
} from '@/lib/platform/customer-ai-workforce/pilot-task-persistence'
import type {
  CustomerAiPilotApprovalRecord,
  CustomerAiPilotTaskRecord,
} from '@/lib/platform/customer-ai-workforce/pilot-types'

function defaultPersistence(): PilotTaskPersistence {
  if (process.env.VITEST === 'true' || process.env.NODE_ENV === 'test') {
    return memoryPilotTaskPersistence
  }
  if (isCustomerAiPilotDurableEnabled()) {
    return prismaPilotTaskPersistence
  }
  return memoryPilotTaskPersistence
}

let activePersistence: PilotTaskPersistence = defaultPersistence()

export function setPilotTaskPersistenceForTests(store: PilotTaskPersistence): void {
  activePersistence = store
}

export function resetCustomerAiPilotTaskStoreForTests(): void {
  memoryPilotTaskPersistence.resetForTests()
  activePersistence = memoryPilotTaskPersistence
}

export async function findPilotTaskByIdempotency(
  customerAccountId: string,
  employeeId: string,
  idempotencyKey: string,
): Promise<CustomerAiPilotTaskRecord | null> {
  return activePersistence.findPilotTaskByIdempotency(customerAccountId, employeeId, idempotencyKey)
}

export async function savePilotTask(record: SavePilotTaskInput): Promise<CustomerAiPilotTaskRecord> {
  return activePersistence.savePilotTask(record)
}

export async function findPilotTaskById(id: string): Promise<CustomerAiPilotTaskRecord | null> {
  return activePersistence.findPilotTaskById(id)
}

export async function updatePilotTaskWorkflow(
  taskId: string,
  patch: PilotTaskWorkflowPatch,
): Promise<CustomerAiPilotTaskRecord | null> {
  return activePersistence.updatePilotTaskWorkflow(taskId, patch)
}

export async function savePilotApproval(record: SavePilotApprovalInput): Promise<CustomerAiPilotApprovalRecord> {
  return activePersistence.savePilotApproval(record)
}

export async function findPilotApprovalById(id: string): Promise<CustomerAiPilotApprovalRecord | null> {
  return activePersistence.findPilotApprovalById(id)
}

export async function updatePilotApproval(
  id: string,
  patch: Partial<CustomerAiPilotApprovalRecord>,
  options?: { consumeIfUnset?: boolean },
): Promise<CustomerAiPilotApprovalRecord | null> {
  return activePersistence.updatePilotApproval(id, patch, options)
}

export async function linkPilotTaskApproval(taskId: string, approvalId: string): Promise<void> {
  return activePersistence.linkPilotTaskApproval(taskId, approvalId)
}

/** @deprecated Use updatePilotApproval with consumeIfUnset for concurrency-safe consume */
export { memoryPilotTaskPersistence }

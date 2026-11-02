import type {
  CustomerAiPilotApprovalRecord,
  CustomerAiPilotTaskRecord,
} from '@/lib/platform/customer-ai-workforce/pilot-types'

export type SavePilotTaskInput = Omit<CustomerAiPilotTaskRecord, 'id' | 'publicId' | 'createdAt'>

export type SavePilotApprovalInput = Omit<CustomerAiPilotApprovalRecord, 'id' | 'createdAt'>

export type PilotTaskWorkflowPatch = {
  workflowJobId?: string | null
  workflowSyncState?: CustomerAiPilotTaskRecord['workflowSyncState']
  workflowValidatedAt?: Date | null
}

export interface PilotTaskPersistence {
  resetForTests(): void
  findPilotTaskByIdempotency(
    customerAccountId: string,
    employeeId: string,
    idempotencyKey: string,
  ): Promise<CustomerAiPilotTaskRecord | null>
  savePilotTask(record: SavePilotTaskInput): Promise<CustomerAiPilotTaskRecord>
  findPilotTaskById(id: string): Promise<CustomerAiPilotTaskRecord | null>
  updatePilotTaskWorkflow(taskId: string, patch: PilotTaskWorkflowPatch): Promise<CustomerAiPilotTaskRecord | null>
  savePilotApproval(record: SavePilotApprovalInput): Promise<CustomerAiPilotApprovalRecord>
  findPilotApprovalById(id: string): Promise<CustomerAiPilotApprovalRecord | null>
  updatePilotApproval(
    id: string,
    patch: Partial<CustomerAiPilotApprovalRecord>,
    options?: { consumeIfUnset?: boolean },
  ): Promise<CustomerAiPilotApprovalRecord | null>
  linkPilotTaskApproval(taskId: string, approvalId: string): Promise<void>
}

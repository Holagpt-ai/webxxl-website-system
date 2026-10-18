import { INTERNAL_AGENT_DEFINITIONS } from '@/lib/platform/workforce/internal-agents'
import type {
  InternalAgentDefinitionRecord,
  WorkforceApprovalRecord,
  WorkforceAuditRecord,
  WorkforceBudgetUsageRecord,
  WorkforcePauseRecord,
  WorkforceTaskRecord,
  WorkforceToolCallRecord,
} from '@/lib/platform/workforce/types'
import type { AiToolGrant } from '@/lib/platform/ai-tools/types'
import type { WorkforceHumanPermission } from '@/lib/platform/workforce/operator-auth'

export type TrustedHumanOperatorRegistration = {
  permissions: WorkforceHumanPermission[]
  platformWide: boolean
}

export type WorkforceStore = {
  agents: Map<string, InternalAgentDefinitionRecord>
  tasks: Map<string, WorkforceTaskRecord>
  tasksByIdempotency: Map<string, string>
  approvals: Map<string, WorkforceApprovalRecord>
  budgetUsage: Map<string, WorkforceBudgetUsageRecord>
  pauses: WorkforcePauseRecord[]
  audits: WorkforceAuditRecord[]
  toolCalls: Map<string, WorkforceToolCallRecord>
  toolGrants: AiToolGrant[]
  operatingMemberships: { userId: string; customerAccountId: string }[]
  /** Server-resolved human operators (synthetic fixtures in tests; session-backed in production). */
  trustedHumanOperators: Map<string, TrustedHumanOperatorRegistration>
}

export function createWorkforceStore(seedGrants: AiToolGrant[] = []): WorkforceStore {
  const agents = new Map<string, InternalAgentDefinitionRecord>()
  for (const agent of INTERNAL_AGENT_DEFINITIONS) agents.set(agent.id, { ...agent })
  return {
    agents,
    tasks: new Map(),
    tasksByIdempotency: new Map(),
    approvals: new Map(),
    budgetUsage: new Map(),
    pauses: [],
    audits: [],
    toolCalls: new Map(),
    toolGrants: seedGrants,
    operatingMemberships: [],
    trustedHumanOperators: new Map(),
  }
}

/**
 * Mirrors pending Prisma ON DELETE RESTRICT rules for workforce history tables.
 */
export function deleteWorkforceTaskIfAllowed(
  store: WorkforceStore,
  taskId: string,
): { ok: true } | { ok: false; code: string; message: string } {
  for (const approval of store.approvals.values()) {
    if (approval.taskId === taskId) {
      return {
        ok: false,
        code: 'TASK_HISTORY_PROTECTED',
        message: 'Cannot delete task while approval records exist',
      }
    }
  }
  for (const call of store.toolCalls.values()) {
    if (call.taskId === taskId) {
      return {
        ok: false,
        code: 'TASK_HISTORY_PROTECTED',
        message: 'Cannot delete task while tool-call records exist',
      }
    }
  }
  const task = store.tasks.get(taskId)
  if (!task) return { ok: false, code: 'NOT_FOUND', message: 'Task not found' }
  store.tasks.delete(taskId)
  store.tasksByIdempotency.delete(task.idempotencyKey)
  return { ok: true }
}

export function nextWorkforceId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 12)}`
}

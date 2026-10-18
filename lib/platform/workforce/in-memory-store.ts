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
  }
}

export function nextWorkforceId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 12)}`
}

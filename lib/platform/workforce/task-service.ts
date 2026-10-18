import { isInternalWorkforceEnabled, isPaperclipExecutionEnabled } from '@/config/workforce'
import { recordWorkforceAudit } from '@/lib/platform/workforce/audit'
import { reserveWorkforceBudget, releaseWorkforceBudget } from '@/lib/platform/workforce/budget-service'
import { stableInputHash } from '@/lib/platform/workforce/hash'
import { getInternalAgentDefinition } from '@/lib/platform/workforce/internal-agents'
import { nextWorkforceId, type WorkforceStore } from '@/lib/platform/workforce/in-memory-store'
import { isWorkforcePaused } from '@/lib/platform/workforce/pause-service'
import { assertTaskTransition } from '@/lib/platform/workforce/transitions'
import type {
  CreateWorkforceTaskInput,
  WorkforceExecutionPhase,
  WorkforceResult,
  WorkforceTaskRecord,
  WorkforceTaskStatus,
} from '@/lib/platform/workforce/types'

function touch(task: WorkforceTaskRecord): void {
  task.updatedAt = new Date()
}

export function createWorkforceTask(
  store: WorkforceStore,
  input: CreateWorkforceTaskInput,
): WorkforceResult<WorkforceTaskRecord> {
  if (!isInternalWorkforceEnabled()) {
    return { ok: false, code: 'WORKFORCE_DISABLED', message: 'Internal workforce is disabled' }
  }
  const existingId = store.tasksByIdempotency.get(input.idempotencyKey)
  if (existingId) {
    const existing = store.tasks.get(existingId)
    if (existing) return { ok: true, value: existing }
  }
  const agent =
    store.agents.get(input.internalAgentKey) ?? getInternalAgentDefinition(input.internalAgentKey)
  if (!agent) return { ok: false, code: 'UNKNOWN_AGENT', message: 'Internal agent not registered' }
  if (agent.paused) {
    return { ok: false, code: 'AGENT_DISABLED', message: 'Agent is paused' }
  }
  if (
    agent.providerAdapterKey === 'paperclip' &&
    isPaperclipExecutionEnabled() &&
    !agent.liveExecutionEnabled
  ) {
    return { ok: false, code: 'AGENT_LIVE_DISABLED', message: 'Live Paperclip execution not enabled for agent' }
  }
  if (
    isWorkforcePaused(store, {
      agentKey: agent.id,
      providerKey: agent.providerAdapterKey,
    })
  ) {
    return { ok: false, code: 'PAUSED', message: 'Workforce pause active' }
  }

  const inputHash = stableInputHash(input.inputPayload)
  const task: WorkforceTaskRecord = {
    id: nextWorkforceId('wftask'),
    idempotencyKey: input.idempotencyKey,
    correlationId: input.correlationId,
    status: 'DRAFT',
    executionPhase: 'TASK_PREPARED',
    internalAgentKey: agent.id,
    requestedByUserId: input.requestedByUserId,
    customerAccountId: input.customerAccountId,
    managedSiteId: input.managedSiteId,
    projectId: input.projectId,
    capability: input.capability,
    inputArtifactRef: input.inputArtifactRef,
    inputHash,
    approvalRequired: input.approvalRequired ?? true,
    dependsOnTaskId: input.dependsOnTaskId,
    providerKey: agent.providerAdapterKey,
    attemptCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  store.tasks.set(task.id, task)
  store.tasksByIdempotency.set(task.idempotencyKey, task.id)
  recordWorkforceAudit(store, {
    taskId: task.id,
    actorUserId: input.requestedByUserId,
    actorType: 'USER',
    eventKind: 'TASK_CREATED',
  })
  return { ok: true, value: task }
}

export function setWorkforceTaskPhase(
  store: WorkforceStore,
  taskId: string,
  phase: WorkforceExecutionPhase,
): WorkforceResult<WorkforceTaskRecord> {
  const task = store.tasks.get(taskId)
  if (!task) return { ok: false, code: 'NOT_FOUND', message: 'Task not found' }
  task.executionPhase = phase
  touch(task)
  return { ok: true, value: task }
}

export function transitionWorkforceTask(
  store: WorkforceStore,
  taskId: string,
  to: WorkforceTaskStatus,
  reasonCode: string,
  patch?: Partial<WorkforceTaskRecord>,
): WorkforceResult<WorkforceTaskRecord> {
  const task = store.tasks.get(taskId)
  if (!task) return { ok: false, code: 'NOT_FOUND', message: 'Task not found' }
  const gate = assertTaskTransition(task.status, to, reasonCode)
  if (!gate.ok) return gate
  if (
    isWorkforcePaused(store, {
      taskId: task.id,
      agentKey: task.internalAgentKey,
      providerKey: task.providerKey,
    }) &&
    to !== 'PAUSED' &&
    to !== 'CANCELLED'
  ) {
    return { ok: false, code: 'PAUSED', message: 'Task or agent paused' }
  }
  task.status = to
  Object.assign(task, patch ?? {})
  touch(task)
  if (to === 'COMPLETED' || to === 'FAILED' || to === 'CANCELLED') {
    task.completedAt = new Date()
  }
  recordWorkforceAudit(store, {
    taskId: task.id,
    actorType: 'SYSTEM',
    eventKind: 'TASK_TRANSITION',
    detail: { to, reasonCode },
  })
  return { ok: true, value: task }
}

export function queueWorkforceTask(store: WorkforceStore, taskId: string): WorkforceResult<WorkforceTaskRecord> {
  return transitionWorkforceTask(store, taskId, 'QUEUED', 'queue')
}

export function authorizeWorkforceTask(
  store: WorkforceStore,
  taskId: string,
  budgetIdempotencyKey: string,
  estimatedSubunits: number,
): WorkforceResult<WorkforceTaskRecord> {
  const task = store.tasks.get(taskId)
  if (!task) return { ok: false, code: 'NOT_FOUND', message: 'Task not found' }
  const agent = store.agents.get(task.internalAgentKey) ?? getInternalAgentDefinition(task.internalAgentKey)
  if (!agent) return { ok: false, code: 'UNKNOWN_AGENT', message: 'Agent missing' }
  const reserve = reserveWorkforceBudget(store, {
    internalAgentKey: agent.id,
    taskId,
    idempotencyKey: budgetIdempotencyKey,
    amountSubunits: estimatedSubunits,
    agentLimitSubunits: agent.budgetLimitSubunits,
  })
  if (!reserve.ok) return reserve
  const moved = transitionWorkforceTask(store, taskId, 'AUTHORIZED', 'human_approval', {
    executionPhase: 'TASK_AUTHORIZED',
  })
  if (!moved.ok) {
    releaseWorkforceBudget(store, budgetIdempotencyKey)
  }
  return moved
}

import { createWorkforceApproval, decideWorkforceApproval } from '@/lib/platform/workforce/approval-service'
import { authorizeWorkforceToolCall } from '@/lib/platform/workforce/execution-gateway'
import { INTERNAL_AGENT_KEYS } from '@/lib/platform/workforce/internal-agents'
import type { WorkforceStore } from '@/lib/platform/workforce/in-memory-store'
import {
  authorizeWorkforceTask,
  createWorkforceTask,
  queueWorkforceTask,
  setWorkforceTaskPhase,
  transitionWorkforceTask,
} from '@/lib/platform/workforce/task-service'
import { syntheticAcceptTask, syntheticCompleteTask } from '@/lib/platform/workforce/synthetic-provider'
import type { WorkforceResult } from '@/lib/platform/workforce/types'

export type SupervisedWorkflowResult = {
  workflowKey: string
  taskIds: string[]
  finalStatus: string
}

export function runSupervisedEngineeringWorkflow(
  store: WorkforceStore,
  input: {
    staffUserId: string
    customerAccountId: string
    projectId: string
    inputPayload: unknown
    approverUserId: string
  },
): WorkforceResult<SupervisedWorkflowResult> {
  for (const key of [INTERNAL_AGENT_KEYS.projectManager, INTERNAL_AGENT_KEYS.engineer, INTERNAL_AGENT_KEYS.qaReviewer]) {
    const a = store.agents.get(key)
    if (a) a.paused = false
  }

  const pmTask = createWorkforceTask(store, {
    idempotencyKey: `wf_pm_${input.projectId}`,
    internalAgentKey: INTERNAL_AGENT_KEYS.projectManager,
    requestedByUserId: input.staffUserId,
    customerAccountId: input.customerAccountId,
    projectId: input.projectId,
    capability: 'engineering.request',
    inputPayload: input.inputPayload,
    approvalRequired: true,
  })
  if (!pmTask.ok) return pmTask
  queueWorkforceTask(store, pmTask.value.id)
  transitionWorkforceTask(store, pmTask.value.id, 'AWAITING_APPROVAL', 'needs_approval')

  const approval = createWorkforceApproval(store, {
    taskId: pmTask.value.id,
    capability: pmTask.value.capability,
    artifactHash: pmTask.value.inputHash,
    expiresAt: new Date(Date.now() + 3600_000),
  })
  const decided = decideWorkforceApproval(store, {
    approvalId: approval.id,
    approverUserId: input.approverUserId,
    decision: 'APPROVED',
    taskAssignedAgentKey: INTERNAL_AGENT_KEYS.projectManager,
  })
  if (!decided.ok) return decided

  const authorized = authorizeWorkforceTask(store, pmTask.value.id, `budget_${pmTask.value.id}`, 500)
  if (!authorized.ok) return authorized

  const engAgent = store.agents.get(INTERNAL_AGENT_KEYS.engineer)
  if (engAgent) engAgent.paused = false

  const engTask = createWorkforceTask(store, {
    idempotencyKey: `wf_eng_${input.projectId}`,
    internalAgentKey: INTERNAL_AGENT_KEYS.engineer,
    requestedByUserId: input.staffUserId,
    customerAccountId: input.customerAccountId,
    projectId: input.projectId,
    capability: 'engineering.implement',
    inputPayload: input.inputPayload,
    approvalRequired: true,
    dependsOnTaskId: pmTask.value.id,
  })
  if (!engTask.ok) return engTask
  queueWorkforceTask(store, engTask.value.id)

  const engApproval = createWorkforceApproval(store, {
    taskId: engTask.value.id,
    capability: engTask.value.capability,
    artifactHash: engTask.value.inputHash,
    expiresAt: new Date(Date.now() + 3600_000),
  })
  decideWorkforceApproval(store, {
    approvalId: engApproval.id,
    approverUserId: input.approverUserId,
    decision: 'APPROVED',
    taskAssignedAgentKey: INTERNAL_AGENT_KEYS.engineer,
  })
  authorizeWorkforceTask(store, engTask.value.id, `budget_${engTask.value.id}`, 800)
  transitionWorkforceTask(store, engTask.value.id, 'RUNNING', 'dispatch', {
    executionPhase: 'PROVIDER_ACCEPTED',
    externalProviderRunId: syntheticAcceptTask(engTask.value.id).externalRunId,
  })

  authorizeWorkforceToolCall(store, {
    taskId: engTask.value.id,
    actorId: INTERNAL_AGENT_KEYS.engineer,
    actorType: 'AGENT',
    customerAccountId: input.customerAccountId,
    toolKey: 'projects.proposeUpdate',
    requestId: `req_${engTask.value.id}`,
    inputHash: engTask.value.inputHash,
    approvalId: engApproval.id,
  })

  const done = syntheticCompleteTask(engTask.value.id, `artifact://${engTask.value.id}`)
  setWorkforceTaskPhase(store, engTask.value.id, 'WORK_IN_PROGRESS')
  setWorkforceTaskPhase(store, engTask.value.id, 'REVIEW_REQUIRED')
  transitionWorkforceTask(store, engTask.value.id, 'COMPLETED', 'complete', {
    executionPhase: 'COMPLETED',
    resultArtifactRef: done.artifactRef,
  })

  return {
    ok: true,
    value: {
      workflowKey: 'supervised_engineering',
      taskIds: [pmTask.value.id, engTask.value.id],
      finalStatus: 'COMPLETED',
    },
  }
}

export function runSupervisedDocumentationWorkflow(
  store: WorkforceStore,
  input: { staffUserId: string; customerAccountId: string; approverUserId: string },
): WorkforceResult<SupervisedWorkflowResult> {
  const docAgent = store.agents.get(INTERNAL_AGENT_KEYS.documentation)
  if (docAgent) docAgent.paused = false
  const task = createWorkforceTask(store, {
    idempotencyKey: `wf_doc_${input.customerAccountId}`,
    internalAgentKey: INTERNAL_AGENT_KEYS.documentation,
    requestedByUserId: input.staffUserId,
    customerAccountId: input.customerAccountId,
    capability: 'documentation.changelog',
    inputPayload: { scope: 'release-notes' },
    approvalRequired: false,
  })
  if (!task.ok) return task
  queueWorkforceTask(store, task.value.id)
  transitionWorkforceTask(store, task.value.id, 'AUTHORIZED', 'auto', { executionPhase: 'TASK_AUTHORIZED' })
  transitionWorkforceTask(store, task.value.id, 'RUNNING', 'run', { executionPhase: 'WORK_IN_PROGRESS' })
  transitionWorkforceTask(store, task.value.id, 'COMPLETED', 'done', {
    executionPhase: 'COMPLETED',
    resultArtifactRef: `artifact://doc_${task.value.id}`,
  })
  return {
    ok: true,
    value: { workflowKey: 'supervised_documentation', taskIds: [task.value.id], finalStatus: 'COMPLETED' },
  }
}

export function runSupervisedOperationsWorkflow(
  store: WorkforceStore,
  input: { staffUserId: string; approverUserId: string },
): WorkforceResult<SupervisedWorkflowResult> {
  const ops = store.agents.get(INTERNAL_AGENT_KEYS.operations)
  if (ops) ops.paused = false
  const task = createWorkforceTask(store, {
    idempotencyKey: `wf_ops_${Date.now()}`,
    internalAgentKey: INTERNAL_AGENT_KEYS.operations,
    requestedByUserId: input.staffUserId,
    capability: 'operations.diagnostic',
    inputPayload: { check: 'staging-health' },
    approvalRequired: true,
  })
  if (!task.ok) return task
  queueWorkforceTask(store, task.value.id)
  const approval = createWorkforceApproval(store, {
    taskId: task.value.id,
    capability: task.value.capability,
    artifactHash: task.value.inputHash,
    expiresAt: new Date(Date.now() + 3600_000),
  })
  decideWorkforceApproval(store, {
    approvalId: approval.id,
    approverUserId: input.approverUserId,
    decision: 'APPROVED',
    taskAssignedAgentKey: INTERNAL_AGENT_KEYS.operations,
  })
  authorizeWorkforceTask(store, task.value.id, `budget_${task.value.id}`, 200)
  transitionWorkforceTask(store, task.value.id, 'COMPLETED', 'report', {
    executionPhase: 'COMPLETED',
    resultArtifactRef: 'artifact://ops_report',
  })
  return {
    ok: true,
    value: { workflowKey: 'supervised_operations', taskIds: [task.value.id], finalStatus: 'COMPLETED' },
  }
}

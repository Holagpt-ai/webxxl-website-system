/**
 * @internal TEST-ONLY supervised workflow simulators (nonproduction).
 * Do not invoke from production routes while INTERNAL_WORKFORCE_ENABLED remains false.
 */
import { createWorkforceApproval, decideWorkforceApproval } from '@/lib/platform/workforce/approval-service'
import { authorizeWorkforceToolCall } from '@/lib/platform/workforce/execution-gateway'
import { INTERNAL_AGENT_KEYS } from '@/lib/platform/workforce/internal-agents'
import type { WorkforceStore } from '@/lib/platform/workforce/in-memory-store'
import { isWorkforcePaused } from '@/lib/platform/workforce/pause-service'
import { trustedStaffApprover } from '@/lib/platform/workforce/test-fixtures'
import {
  authorizeWorkforceTask,
  createWorkforceTask,
  queueWorkforceTask,
  setWorkforceTaskPhase,
  transitionWorkforceTask,
} from '@/lib/platform/workforce/task-service'
import { syntheticAcceptTask, syntheticCompleteTask } from '@/lib/platform/workforce/synthetic-provider'
import type { WorkforceResult } from '@/lib/platform/workforce/types'
import type { TrustedWorkforceHumanActor } from '@/lib/platform/workforce/operator-auth'

export type SupervisedWorkflowResult = {
  workflowKey: string
  taskIds: string[]
  finalStatus: string
}

function assertWorkflowNotPaused(store: WorkforceStore): WorkforceResult<true> {
  if (isWorkforcePaused(store, {})) {
    return { ok: false, code: 'PAUSED', message: 'Synthetic workflow blocked by active pause' }
  }
  return { ok: true, value: true }
}

function unpauseAgentsForTest(store: WorkforceStore, keys: string[]): void {
  if (isWorkforcePaused(store, {})) return
  for (const key of keys) {
    const agent = store.agents.get(key)
    if (agent && !isWorkforcePaused(store, { agentKey: key })) {
      agent.paused = false
    }
  }
}

export function runSupervisedEngineeringWorkflow(
  store: WorkforceStore,
  input: {
    staffUserId: string
    customerAccountId: string
    projectId: string
    inputPayload: unknown
    trustedApprover: TrustedWorkforceHumanActor
  },
): WorkforceResult<SupervisedWorkflowResult> {
  const pauseGate = assertWorkflowNotPaused(store)
  if (!pauseGate.ok) return pauseGate

  unpauseAgentsForTest(store, [
    INTERNAL_AGENT_KEYS.projectManager,
    INTERNAL_AGENT_KEYS.engineer,
    INTERNAL_AGENT_KEYS.qaReviewer,
  ])

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
    trustedOperator: input.trustedApprover,
    decision: 'APPROVED',
    taskAssignedAgentKey: INTERNAL_AGENT_KEYS.projectManager,
  })
  if (!decided.ok) return decided

  const authorized = authorizeWorkforceTask(store, pmTask.value.id, {
    budgetIdempotencyKey: `budget_${pmTask.value.id}`,
    estimatedSubunits: 500,
    approvalId: approval.id,
  })
  if (!authorized.ok) return authorized

  unpauseAgentsForTest(store, [INTERNAL_AGENT_KEYS.engineer])

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
  transitionWorkforceTask(store, engTask.value.id, 'AWAITING_APPROVAL', 'needs_approval')

  const engApproval = createWorkforceApproval(store, {
    taskId: engTask.value.id,
    capability: engTask.value.capability,
    artifactHash: engTask.value.inputHash,
    expiresAt: new Date(Date.now() + 3600_000),
  })
  const engDecided = decideWorkforceApproval(store, {
    approvalId: engApproval.id,
    trustedOperator: input.trustedApprover,
    decision: 'APPROVED',
    taskAssignedAgentKey: INTERNAL_AGENT_KEYS.engineer,
  })
  if (!engDecided.ok) return engDecided

  const engAuthorized = authorizeWorkforceTask(store, engTask.value.id, {
    budgetIdempotencyKey: `budget_${engTask.value.id}`,
    estimatedSubunits: 800,
    approvalId: engApproval.id,
  })
  if (!engAuthorized.ok) return engAuthorized

  transitionWorkforceTask(store, engTask.value.id, 'RUNNING', 'dispatch', {
    executionPhase: 'PROVIDER_ACCEPTED',
    externalProviderRunId: syntheticAcceptTask(engTask.value.id).externalRunId,
  })

  const tool = authorizeWorkforceToolCall(store, {
    taskId: engTask.value.id,
    actorId: INTERNAL_AGENT_KEYS.engineer,
    actorType: 'AGENT',
    customerAccountId: input.customerAccountId,
    toolKey: 'projects.proposeUpdate',
    requestId: `req_${engTask.value.id}`,
    inputHash: engTask.value.inputHash,
    approvalId: engApproval.id,
  })
  if (!tool.ok) return tool

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
  input: { staffUserId: string; customerAccountId: string; trustedApprover: TrustedWorkforceHumanActor },
): WorkforceResult<SupervisedWorkflowResult> {
  const pauseGate = assertWorkflowNotPaused(store)
  if (!pauseGate.ok) return pauseGate

  unpauseAgentsForTest(store, [INTERNAL_AGENT_KEYS.documentation])
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
  transitionWorkforceTask(store, task.value.id, 'AWAITING_APPROVAL', 'policy')
  const authorized = authorizeWorkforceTask(store, task.value.id, {
    budgetIdempotencyKey: `budget_${task.value.id}`,
    estimatedSubunits: 100,
  })
  if (!authorized.ok) return authorized
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
  input: { staffUserId: string; trustedApprover: TrustedWorkforceHumanActor },
): WorkforceResult<SupervisedWorkflowResult> {
  const pauseGate = assertWorkflowNotPaused(store)
  if (!pauseGate.ok) return pauseGate

  unpauseAgentsForTest(store, [INTERNAL_AGENT_KEYS.operations])
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
  transitionWorkforceTask(store, task.value.id, 'AWAITING_APPROVAL', 'needs_approval')
  const approval = createWorkforceApproval(store, {
    taskId: task.value.id,
    capability: task.value.capability,
    artifactHash: task.value.inputHash,
    expiresAt: new Date(Date.now() + 3600_000),
  })
  const decided = decideWorkforceApproval(store, {
    approvalId: approval.id,
    trustedOperator: input.trustedApprover,
    decision: 'APPROVED',
    taskAssignedAgentKey: INTERNAL_AGENT_KEYS.operations,
  })
  if (!decided.ok) return decided
  const authorized = authorizeWorkforceTask(store, task.value.id, {
    budgetIdempotencyKey: `budget_${task.value.id}`,
    estimatedSubunits: 200,
    approvalId: approval.id,
  })
  if (!authorized.ok) return authorized
  transitionWorkforceTask(store, task.value.id, 'COMPLETED', 'report', {
    executionPhase: 'COMPLETED',
    resultArtifactRef: 'artifact://ops_report',
  })
  return {
    ok: true,
    value: { workflowKey: 'supervised_operations', taskIds: [task.value.id], finalStatus: 'COMPLETED' },
  }
}

/** Convenience for Vitest — uses synthetic trusted staff approver fixture. */
export function runSupervisedEngineeringWorkflowWithFixture(
  store: WorkforceStore,
  input: Omit<Parameters<typeof runSupervisedEngineeringWorkflow>[1], 'trustedApprover'>,
): WorkforceResult<SupervisedWorkflowResult> {
  return runSupervisedEngineeringWorkflow(store, { ...input, trustedApprover: trustedStaffApprover() })
}

export function runSupervisedDocumentationWorkflowWithFixture(
  store: WorkforceStore,
  input: Omit<Parameters<typeof runSupervisedDocumentationWorkflow>[1], 'trustedApprover'>,
): WorkforceResult<SupervisedWorkflowResult> {
  return runSupervisedDocumentationWorkflow(store, { ...input, trustedApprover: trustedStaffApprover() })
}

export function runSupervisedOperationsWorkflowWithFixture(
  store: WorkforceStore,
  input: Omit<Parameters<typeof runSupervisedOperationsWorkflow>[1], 'trustedApprover'>,
): WorkforceResult<SupervisedWorkflowResult> {
  return runSupervisedOperationsWorkflow(store, { ...input, trustedApprover: trustedStaffApprover() })
}

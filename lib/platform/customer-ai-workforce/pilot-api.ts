import {
  issueCustomerAiPilotApproval,
  validateCustomerAiPilotApproval,
  type IssuePilotApprovalInput,
  type ValidatePilotApprovalInput,
} from '@/lib/platform/customer-ai-workforce/pilot-approval-service'
import {
  assertCustomerAiPilotPrepEnabled,
} from '@/lib/platform/customer-ai-workforce/pilot-prep-gates'
import {
  attemptCustomerAiPilotExecution,
  prepareCustomerAiPilotTask,
  type PrepareCustomerAiPilotTaskInput,
} from '@/lib/platform/customer-ai-workforce/pilot-prep-service'
import { findPilotTaskById } from '@/lib/platform/customer-ai-workforce/pilot-task-store'
import type { CustomerAiActor, CustomerAiResult } from '@/lib/platform/customer-ai-workforce/types'
import type { CustomerAiStore } from '@/lib/platform/customer-ai-workforce/store'

function pilotDisabled(): CustomerAiResult<never> {
  const gate = assertCustomerAiPilotPrepEnabled()
  if (!gate.ok) return gate
  return { ok: false, error: 'EXECUTION_DISABLED', message: 'Unexpected pilot gate state' }
}

export async function prepareCustomerAiPilotTaskApi(
  store: CustomerAiStore,
  actor: CustomerAiActor,
  input: PrepareCustomerAiPilotTaskInput,
) {
  return prepareCustomerAiPilotTask(store, actor, input)
}

export async function issueCustomerAiPilotApprovalApi(
  store: CustomerAiStore,
  actor: CustomerAiActor,
  input: IssuePilotApprovalInput,
) {
  const gate = assertCustomerAiPilotPrepEnabled()
  if (!gate.ok) return gate
  return issueCustomerAiPilotApproval(store, actor, input)
}

export async function validateCustomerAiPilotApprovalApi(input: ValidatePilotApprovalInput) {
  const gate = assertCustomerAiPilotPrepEnabled()
  if (!gate.ok) return gate
  return validateCustomerAiPilotApproval(input)
}

export async function getCustomerAiPilotTask(
  store: CustomerAiStore,
  actor: CustomerAiActor,
  customerAccountId: string,
  taskId: string,
) {
  const gate = assertCustomerAiPilotPrepEnabled()
  if (!gate.ok) return gate
  if (!store.isStaff(actor.userId, actor.platformRole)) {
    if (!(await store.hasOperatingMembership(actor.userId, customerAccountId))) {
      return { ok: false as const, error: 'FORBIDDEN' as const, message: 'Operating membership required' }
    }
  }
  const task = findPilotTaskById(taskId)
  if (!task || task.customerAccountId !== customerAccountId) {
    return { ok: false as const, error: 'NOT_FOUND' as const, message: 'Task not found' }
  }
  return {
    ok: true as const,
    value: {
      taskId: task.id,
      publicId: task.publicId,
      outcome: task.outcome,
      workflowKind: task.workflowKind,
      actionHash: task.actionHash,
      requiresHumanApproval: task.requiresHumanApproval,
      approvalId: task.approvalId,
    },
  }
}

export async function attemptCustomerAiPilotExecutionApi(
  store: CustomerAiStore,
  actor: CustomerAiActor,
  input: { customerAccountId: string; taskId: string; approvalId?: string },
) {
  const gate = assertCustomerAiPilotPrepEnabled()
  if (!gate.ok) return gate
  if (!store.isStaff(actor.userId, actor.platformRole)) {
    if (!(await store.hasOperatingMembership(actor.userId, input.customerAccountId))) {
      return { ok: false as const, error: 'FORBIDDEN' as const, message: 'Operating membership required' }
    }
  }
  const task = findPilotTaskById(input.taskId)
  if (!task || task.customerAccountId !== input.customerAccountId) {
    return { ok: false as const, error: 'NOT_FOUND' as const, message: 'Task not found' }
  }
  if (input.approvalId) {
    const validated = validateCustomerAiPilotApproval({
      approvalId: input.approvalId,
      preparedTaskId: task.id,
      customerAccountId: task.customerAccountId,
      managedSiteId: task.managedSiteId,
      employeeId: task.employeeId,
      toolKey: task.toolKey,
      workflowKind: task.workflowKind,
      actionHash: task.actionHash,
      allowedAction: 'execute_prepared_draft',
      estimatedCostUnits: task.estimatedCostUnits,
      consume: false,
    })
    if (!validated.ok) return validated
  }
  return attemptCustomerAiPilotExecution(store, actor, { taskId: input.taskId, approvalId: input.approvalId })
}

export { pilotDisabled }

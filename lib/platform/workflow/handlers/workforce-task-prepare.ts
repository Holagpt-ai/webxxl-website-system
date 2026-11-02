import {
  isCustomerAiExecutionEnabled,
  isCustomerAiPilotPrepEnabled,
} from '@/config/customer-ai-workforce'
import { findPilotTaskById, updatePilotTaskWorkflow } from '@/lib/platform/customer-ai-workforce/pilot-task-store'
import { recheckPilotPreparationEligibility } from '@/lib/platform/customer-ai-workforce/pilot-prep-service'
import { prismaCustomerAiStore } from '@/lib/platform/customer-ai-workforce/prisma-store'
import type { HandlerExecutionContext, HandlerExecutionResult } from '@/lib/platform/workflow/types'

export async function executeWorkforceTaskPrepareWorkflow(
  ctx: HandlerExecutionContext,
  payload: Record<string, unknown>,
): Promise<HandlerExecutionResult> {
  if (!isCustomerAiPilotPrepEnabled()) {
    return { outcome: 'BLOCKED', errorCode: 'PILOT_PREP_DISABLED' }
  }
  if (isCustomerAiExecutionEnabled()) {
    return { outcome: 'BLOCKED', errorCode: 'LIVE_EXECUTION_BLOCKED' }
  }

  const pilotTaskId = typeof payload.pilotTaskId === 'string' ? payload.pilotTaskId : null
  if (!pilotTaskId) {
    return { outcome: 'FAILED_TERMINAL', errorClass: 'PERMANENT', errorCode: 'MISSING_PILOT_TASK' }
  }

  const task = await findPilotTaskById(pilotTaskId)
  if (!task) {
    return { outcome: 'FAILED_TERMINAL', errorClass: 'PERMANENT', errorCode: 'PILOT_TASK_NOT_FOUND' }
  }

  if (ctx.job.customerAccountId && ctx.job.customerAccountId !== task.customerAccountId) {
    return { outcome: 'FAILED_TERMINAL', errorClass: 'PERMANENT', errorCode: 'TENANT_MISMATCH' }
  }
  if (typeof payload.actionHash === 'string' && payload.actionHash !== task.actionHash) {
    return { outcome: 'FAILED_TERMINAL', errorClass: 'PERMANENT', errorCode: 'ACTION_HASH_MISMATCH' }
  }
  if (ctx.job.sourceId && ctx.job.sourceId !== task.id) {
    return { outcome: 'FAILED_TERMINAL', errorClass: 'PERMANENT', errorCode: 'SOURCE_BINDING_MISMATCH' }
  }

  if (task.outcome === 'BLOCKED' || task.outcome === 'UNVERIFIED') {
    await updatePilotTaskWorkflow(task.id, {
      workflowSyncState: 'FAILED',
      ifCurrentSyncStateIn: ['NOT_QUEUED', 'QUEUED', 'FAILED'],
    })
    return { outcome: 'FAILED_TERMINAL', errorClass: 'PERMANENT', errorCode: 'PILOT_OUTCOME_NOT_VALIDATABLE' }
  }

  const recheck = await recheckPilotPreparationEligibility(prismaCustomerAiStore, {
    customerAccountId: task.customerAccountId,
    employeeId: task.employeeId,
    managedSiteId: task.managedSiteId,
    workflowKind: task.workflowKind,
    idempotencyKey: task.idempotencyKey,
    prepareConsequentialDraft: false,
    context: {
      locale: (task.provenance.locale as string) ?? 'en',
      managedSiteId: task.managedSiteId,
      trustedDataSource: 'SERVER',
    },
  })

  if (!recheck.ok) {
    await updatePilotTaskWorkflow(task.id, {
      workflowSyncState: 'FAILED',
      workflowValidatedAt: null,
      invalidateValidated: true,
      ifCurrentSyncStateIn: ['QUEUED', 'NOT_QUEUED', 'VALIDATED', 'FAILED'],
    })
    return {
      outcome: 'RETRY',
      errorClass: 'TRANSIENT',
      errorCode: recheck.error,
      retryAfterMs: 30_000,
    }
  }

  if (task.workflowSyncState === 'VALIDATED' && task.workflowValidatedAt) {
    return { outcome: 'COMPLETED', resultRef: `pilot_validated:${task.id}` }
  }

  await updatePilotTaskWorkflow(task.id, {
    workflowSyncState: 'VALIDATED',
    workflowValidatedAt: new Date(),
    ifCurrentSyncStateIn: ['QUEUED', 'NOT_QUEUED'],
  })

  const after = await findPilotTaskById(task.id)
  if (after?.workflowSyncState === 'VALIDATED') {
    return { outcome: 'COMPLETED', resultRef: `pilot_validated:${task.id}` }
  }

  return {
    outcome: 'RETRY',
    errorClass: 'TRANSIENT',
    errorCode: 'WORKFLOW_TRANSITION_RACE',
    retryAfterMs: 5_000,
  }
}

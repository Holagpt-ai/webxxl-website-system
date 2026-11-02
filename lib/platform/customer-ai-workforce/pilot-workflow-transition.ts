import type { CustomerAiPilotWorkflowSyncState } from '@/lib/platform/customer-ai-workforce/pilot-types'
import type { PilotTaskWorkflowPatch } from '@/lib/platform/customer-ai-workforce/pilot-task-persistence'

/** Owner-visible recovery when AUTO-10 enqueue fails after prepare. */
export const PILOT_WORKFLOW_ENQUEUE_FAILURE_RECOVERY =
  'workflowSyncState is FAILED with blockedReason ENQUEUE_FAILED. Enable WORKFLOW_* and CUSTOMER_AI_PILOT_WORKFLOW_ENQUEUE_ENABLED, then prepare again with a new idempotencyKey or owner-repair enqueue WORKFORCE_TASK_PREPARE (sourceType CustomerAiPilotTask, sourceId task id).'

export function pilotWorkflowTransitionAllowed(
  current: CustomerAiPilotWorkflowSyncState,
  patch: PilotTaskWorkflowPatch,
): boolean {
  if (patch.ifCurrentSyncStateIn && !patch.ifCurrentSyncStateIn.includes(current)) {
    return false
  }
  if (
    current === 'VALIDATED' &&
    patch.workflowSyncState !== undefined &&
    patch.workflowSyncState !== 'VALIDATED' &&
    !patch.invalidateValidated
  ) {
    return false
  }
  return true
}

export function isPilotIdempotencyConflict(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === 'PILOT_IDEMPOTENCY_CONFLICT'
  )
}

import { isCustomerAiPilotWorkflowEnqueueEnabled } from '@/config/customer-ai-workforce'
import { enqueueWorkflowJob } from '@/lib/platform/workflow/enqueue-service'
import type { CustomerAiPilotTaskRecord } from '@/lib/platform/customer-ai-workforce/pilot-types'
import { updatePilotTaskWorkflow } from '@/lib/platform/customer-ai-workforce/pilot-task-store'

/**
 * Enqueues AUTO-10 WORKFORCE_TASK_PREPARE for post-preparation validation.
 * Does not enable worker cron or live AI execution — gated by workflow + pilot enqueue flags.
 */
export async function maybeEnqueueCustomerAiPilotWorkflowTask(
  task: CustomerAiPilotTaskRecord,
): Promise<{ queued: boolean; workflowJobId?: string; reason?: string }> {
  if (task.outcome === 'BLOCKED' || task.outcome === 'UNVERIFIED') {
    return { queued: false, reason: 'outcome_not_queueable' }
  }
  if (!isCustomerAiPilotWorkflowEnqueueEnabled()) {
    return { queued: false, reason: 'enqueue_disabled' }
  }

  const idempotencyKey = `customer-ai-pilot:prepare:${task.id}`
  const enqueue = await enqueueWorkflowJob({
    jobKind: 'WORKFORCE_TASK_PREPARE',
    customerAccountId: task.customerAccountId,
    managedSiteId: task.managedSiteId,
    correlationId: task.provenance.correlationId,
    sourceType: 'CustomerAiPilotTask',
    sourceId: task.id,
    sourceRevisionHash: task.actionHash,
    idempotencyKey,
    payloadRef: {
      phase: 'POST_PREP_VALIDATION',
      pilotTaskId: task.id,
      employeeId: task.employeeId,
      workflowKind: task.workflowKind,
      actionHash: task.actionHash,
      externalEffects: false,
    },
  })

  if (!enqueue.ok) {
    await updatePilotTaskWorkflow(task.id, { workflowSyncState: 'FAILED' })
    return { queued: false, reason: enqueue.message ?? enqueue.error }
  }

  await updatePilotTaskWorkflow(task.id, {
    workflowJobId: enqueue.value.id,
    workflowSyncState: 'QUEUED',
  })
  return { queued: true, workflowJobId: enqueue.value.id }
}

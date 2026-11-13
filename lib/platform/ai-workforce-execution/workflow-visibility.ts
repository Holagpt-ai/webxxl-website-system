import {
  isCustomerAiPilotDurableEnabled,
  isCustomerAiPilotWorkflowEnqueueEnabled,
} from '@/config/customer-ai-workforce'
import {
  isWorkflowEnqueueEnabled,
  isWorkflowExternalEffectsEnabled,
  isWorkflowWorkerEnabled,
} from '@/config/workflow-backend'
import { listRegisteredWorkflowKinds } from '@/lib/platform/workflow/handlers/registry'
import { isRetryableWorkflowError } from '@/lib/platform/workflow/retry-policy'
import type { WorkflowErrorClass } from '@prisma/client'
import type { WorkflowHandoffVisibility } from '@/lib/platform/ai-workforce-execution/types'

const ERROR_CLASSES: WorkflowErrorClass[] = [
  'TRANSIENT',
  'RATE_LIMITED',
  'TIMEOUT',
  'PROVIDER_UNAVAILABLE',
  'PERMANENT',
  'AUTHORIZATION_FAILED',
  'POLICY_DENIED',
  'CONFIGURATION_MISSING',
  'UNKNOWN_EXTERNAL_OUTCOME',
]

export function describeWorkflowHandoff(input: {
  idempotencyKey: string
  actionHash: string | null
}): WorkflowHandoffVisibility {
  const registered = listRegisteredWorkflowKinds().includes('WORKFORCE_TASK_PREPARE')
  const enqueueRequested =
    isWorkflowEnqueueEnabled() || isCustomerAiPilotWorkflowEnqueueEnabled()
  const retryableErrorClasses = ERROR_CLASSES.filter((item) => isRetryableWorkflowError(item))
  const nonRetryableErrorClasses = ERROR_CLASSES.filter((item) => !isRetryableWorkflowError(item))
  return {
    handler: 'WORKFORCE_TASK_PREPARE',
    registered,
    state: enqueueRequested ? 'ENQUEUE_WITHHELD' : 'NOT_QUEUED',
    reason: enqueueRequested ? 'BATCH6_DOES_NOT_DISPATCH' : 'WORKFLOW_ENQUEUE_DISABLED',
    enqueueEnabled: isWorkflowEnqueueEnabled(),
    workerEnabled: isWorkflowWorkerEnabled(),
    externalEffectsEnabled: isWorkflowExternalEffectsEnabled(),
    durablePilotEnabled: isCustomerAiPilotDurableEnabled(),
    attemptsExecuted: 0,
    retryableErrorClasses,
    nonRetryableErrorClasses,
    idempotencyKey: input.idempotencyKey,
    actionHash: input.actionHash,
  }
}

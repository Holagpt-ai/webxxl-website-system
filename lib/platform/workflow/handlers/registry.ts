import type { WorkflowJobKind } from '@/lib/platform/workflow/types'
import type { HandlerExecutionContext, HandlerExecutionResult } from '@/lib/platform/workflow/types'
import { executeCommsReceiptWorkflow } from '@/lib/platform/workflow/handlers/comms-receipt'
import { executeMarketingFollowUpWorkflow } from '@/lib/platform/workflow/handlers/marketing-followup'
import { executeSeoSyncPrepareWorkflow } from '@/lib/platform/workflow/handlers/seo-sync-prepare'

export type WorkflowHandler = (ctx: HandlerExecutionContext, payload: Record<string, unknown>) => Promise<HandlerExecutionResult>

const DISABLED_HANDLER: WorkflowHandler = async () => ({
  outcome: 'BLOCKED',
  errorCode: 'NOT_CONFIGURED',
})

const REGISTRY: Record<WorkflowJobKind, WorkflowHandler> = {
  COMMS_RECEIPT_PROCESS: executeCommsReceiptWorkflow,
  CRM_FOLLOWUP_EVALUATE: executeMarketingFollowUpWorkflow,
  SEO_SYNC_PREPARE: executeSeoSyncPrepareWorkflow,
  MARKETING_DRAFT_PREPARE: DISABLED_HANDLER,
  SOCIAL_STATUS_RECONCILE: DISABLED_HANDLER,
  WORKFORCE_TASK_PREPARE: DISABLED_HANDLER,
  WALLET_RECONCILIATION_REVIEW: DISABLED_HANDLER,
  NOTIFICATION_DELIVERY: DISABLED_HANDLER,
}

export function getWorkflowHandler(jobKind: string): WorkflowHandler | null {
  if (!(jobKind in REGISTRY)) return null
  return REGISTRY[jobKind as WorkflowJobKind]
}

export function listRegisteredWorkflowKinds(): WorkflowJobKind[] {
  return Object.keys(REGISTRY) as WorkflowJobKind[]
}

import { isCommsReceiptWorkerEnabled } from '@/config/comms-backend'
import { isWorkflowDurableExecutionAllowed } from '@/config/workflow-backend'
import { processCommsWebhookReceiptById } from '@/lib/platform/comms/receipt-processor'
import type { HandlerExecutionContext, HandlerExecutionResult } from '@/lib/platform/workflow/types'

export async function executeCommsReceiptWorkflow(
  ctx: HandlerExecutionContext,
  payload: Record<string, unknown>,
): Promise<HandlerExecutionResult> {
  if (!isWorkflowDurableExecutionAllowed() || !isCommsReceiptWorkerEnabled()) {
    return { outcome: 'BLOCKED', errorCode: 'NOT_CONFIGURED' }
  }
  const receiptId = payload.receiptId
  if (typeof receiptId !== 'string' || !receiptId) {
    return { outcome: 'FAILED_TERMINAL', errorClass: 'CONFIGURATION_MISSING', errorCode: 'MISSING_RECEIPT_ID' }
  }
  if (ctx.job.sourceId !== receiptId) {
    return { outcome: 'FAILED_TERMINAL', errorClass: 'PERMANENT', errorCode: 'TENANT_RESOURCE_MISMATCH' }
  }
  const result = await processCommsWebhookReceiptById({
    receiptId,
    workerId: ctx.workerId,
  })
  if (!result.ok) {
    if (result.code === 'CONFLICT') {
      return { outcome: 'COMPLETED', resultRef: 'already_processed' }
    }
    if (result.code === 'FORBIDDEN') {
      return { outcome: 'FAILED_TERMINAL', errorClass: 'POLICY_DENIED', errorCode: result.code }
    }
    return { outcome: 'RETRY', errorClass: 'TRANSIENT', errorCode: result.code }
  }
  return { outcome: 'COMPLETED', resultRef: result.value.processingStatus }
}

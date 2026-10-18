import type { WorkflowErrorClass } from '@prisma/client'
import type { HandlerExecutionResult } from '@/lib/platform/workflow/types'

export function classifyHandlerException(error: unknown): HandlerExecutionResult {
  const message = error instanceof Error ? error.message : 'HANDLER_EXCEPTION'
  if (message.includes('UNKNOWN_EXTERNAL') || message.includes('UNCERTAIN_OUTCOME')) {
    return {
      outcome: 'AWAITING_RECONCILIATION',
      errorCode: 'UNKNOWN_EXTERNAL_OUTCOME',
      resultRef: message.slice(0, 200),
    }
  }
  return {
    outcome: 'RETRY',
    errorClass: 'TRANSIENT' satisfies WorkflowErrorClass,
    errorCode: message.slice(0, 120),
  }
}

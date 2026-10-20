import { isCommerceFulfillmentEnabled, isCommerceWorkflowEnqueueEnabled } from '@/config/commerce-backend'
import { isWorkflowDurableExecutionAllowed } from '@/config/workflow-backend'
import type { HandlerExecutionContext, HandlerExecutionResult } from '@/lib/platform/workflow/types'

/** AUTO-10 handler. Stays blocked unless commerce and workflow flags are both enabled. */
export async function executeCommerceWorkflow(
  ctx: HandlerExecutionContext,
  payload: Record<string, unknown>,
): Promise<HandlerExecutionResult> {
  if (!isWorkflowDurableExecutionAllowed() || !isCommerceWorkflowEnqueueEnabled() || !isCommerceFulfillmentEnabled()) {
    return { outcome: 'BLOCKED', errorCode: 'NOT_CONFIGURED' }
  }
  const orderId = payload.orderId
  if (typeof orderId !== 'string' || !orderId) {
    return { outcome: 'FAILED_TERMINAL', errorClass: 'PERMANENT', errorCode: 'MISSING_ORDER' }
  }
  if (ctx.job.sourceId !== orderId) {
    return { outcome: 'FAILED_TERMINAL', errorClass: 'PERMANENT', errorCode: 'TENANT_RESOURCE_MISMATCH' }
  }
  const { prismaCommerceStore } = await import('@/lib/platform/commerce/prisma-store')
  const { executeFulfillment, recoverFulfillment } = await import('@/lib/platform/commerce/engine')
  const run = ctx.job.jobKind === 'COMMERCE_FULFILLMENT_RECOVERY' ? recoverFulfillment : executeFulfillment
  const result = await run(prismaCommerceStore, orderId)
  if (!result.ok) {
    if (result.error === 'MINT_DISABLED' || result.error === 'PROVISIONING_DISABLED' || result.error === 'NOT_CONFIGURED') {
      return { outcome: 'BLOCKED', errorCode: result.error }
    }
    return { outcome: 'RETRY', errorClass: 'TRANSIENT', errorCode: result.error }
  }
  return { outcome: 'COMPLETED', resultRef: result.value.status }
}

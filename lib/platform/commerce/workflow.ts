import { isCommerceWorkflowEnqueueEnabled } from '@/config/commerce-backend'
import type { WorkflowResult, WorkflowJobSnapshot } from '@/lib/platform/workflow/types'

export async function enqueueCommercePreparation(input: {
  orderId: string
  billingGroupId: string
  customerAccountId: string | null
  kind: 'CREDIT' | 'SERVICE'
}): Promise<WorkflowResult<WorkflowJobSnapshot>> {
  if (!isCommerceWorkflowEnqueueEnabled()) {
    return { ok: false, error: 'NOT_CONFIGURED', message: 'Commerce workflow enqueue disabled' }
  }
  const { enqueueWorkflowJob } = await import('@/lib/platform/workflow/enqueue-service')
  const jobKind = input.kind === 'CREDIT' ? 'COMMERCE_CREDIT_ISSUE_PREPARE' : 'COMMERCE_PAYMENT_FULFILL'
  return enqueueWorkflowJob({
    jobKind,
    customerAccountId: input.customerAccountId,
    billingGroupId: input.billingGroupId,
    correlationId: `commerce:${input.orderId}`,
    sourceType: 'CommerceOrder',
    sourceId: input.orderId,
    idempotencyKey: `commerce-prepare:${input.orderId}:${jobKind}`,
    payloadRef: {
      orderId: input.orderId,
      kind: input.kind,
      externalEffects: false,
    },
  })
}

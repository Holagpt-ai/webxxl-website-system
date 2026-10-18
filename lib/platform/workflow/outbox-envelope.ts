import type { EnqueueWorkflowJobInput } from '@/lib/platform/workflow/types'
import { buildWorkflowRequestFingerprint } from '@/lib/platform/workflow/fingerprint'

export const WORKFLOW_OUTBOX_ENVELOPE_VERSION = 1 as const

export type WorkflowOutboxEnvelope = {
  version: typeof WORKFLOW_OUTBOX_ENVELOPE_VERSION
  eventKey: string
  correlationId: string
  requestFingerprint: string
  payloadRef: Record<string, unknown>
  enqueue: EnqueueWorkflowJobInput
}

export function buildWorkflowOutboxEnvelope(input: {
  eventKey: string
  payloadRef: Record<string, unknown>
  enqueue: EnqueueWorkflowJobInput
}): WorkflowOutboxEnvelope {
  const requestFingerprint = buildWorkflowRequestFingerprint({
    customerAccountId: input.enqueue.customerAccountId,
    managedSiteId: input.enqueue.managedSiteId,
    billingGroupId: input.enqueue.billingGroupId,
    jobKind: input.enqueue.jobKind,
    sourceType: input.enqueue.sourceType,
    sourceId: input.enqueue.sourceId,
    sourceRevisionHash: input.enqueue.sourceRevisionHash,
    payloadRef: input.payloadRef,
  })
  return {
    version: WORKFLOW_OUTBOX_ENVELOPE_VERSION,
    eventKey: input.eventKey,
    correlationId: input.enqueue.correlationId,
    requestFingerprint,
    payloadRef: input.payloadRef,
    enqueue: input.enqueue,
  }
}

export function parseWorkflowOutboxEnvelope(payloadRef: unknown): WorkflowOutboxEnvelope | null {
  if (!payloadRef || typeof payloadRef !== 'object') return null
  const row = payloadRef as Record<string, unknown>
  if (row.version !== WORKFLOW_OUTBOX_ENVELOPE_VERSION) return null
  const enqueue = row.enqueue
  if (!enqueue || typeof enqueue !== 'object') return null
  if (typeof row.eventKey !== 'string' || typeof row.correlationId !== 'string') return null
  if (typeof row.requestFingerprint !== 'string') return null
  return row as WorkflowOutboxEnvelope
}

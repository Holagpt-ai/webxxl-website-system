import type { WorkflowJob, WorkflowOutbox } from '@prisma/client'
import type { EnqueueWorkflowJobInput } from '@/lib/platform/workflow/types'
import { buildEnqueueFingerprint, buildWorkflowRequestFingerprint } from '@/lib/platform/workflow/fingerprint'

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

export function canonicalEnqueueFingerprint(enqueue: EnqueueWorkflowJobInput): string {
  return buildEnqueueFingerprint(enqueue)
}

/** Validates immutable outbox identity before dispatch or replay. */
export function validateOutboxEnvelopeForRow(
  row: Pick<WorkflowOutbox, 'eventKey' | 'customerAccountId' | 'jobKind' | 'requestFingerprint'>,
  envelope: WorkflowOutboxEnvelope,
): { ok: true } | { ok: false; reason: string } {
  if (envelope.eventKey !== row.eventKey) return { ok: false, reason: 'event_key_mismatch' }
  if (envelope.requestFingerprint !== row.requestFingerprint) return { ok: false, reason: 'fingerprint_mismatch' }
  if (row.jobKind !== envelope.enqueue.jobKind) return { ok: false, reason: 'job_kind_mismatch' }
  const rowAccount = row.customerAccountId ?? null
  const enqueueAccount = envelope.enqueue.customerAccountId ?? null
  if (rowAccount !== enqueueAccount) return { ok: false, reason: 'tenant_mismatch' }
  const rebuilt = buildWorkflowRequestFingerprint({
    customerAccountId: envelope.enqueue.customerAccountId,
    managedSiteId: envelope.enqueue.managedSiteId,
    billingGroupId: envelope.enqueue.billingGroupId,
    jobKind: envelope.enqueue.jobKind,
    sourceType: envelope.enqueue.sourceType,
    sourceId: envelope.enqueue.sourceId,
    sourceRevisionHash: envelope.enqueue.sourceRevisionHash,
    payloadRef: envelope.payloadRef,
  })
  if (rebuilt !== envelope.requestFingerprint) return { ok: false, reason: 'canonical_fingerprint_drift' }
  if (!envelopePayloadRefsConsistent(envelope)) return { ok: false, reason: 'payload_ref_mismatch' }
  return { ok: true }
}

function stableJson(value: Record<string, unknown>): string {
  const keys = Object.keys(value).sort()
  const ordered: Record<string, unknown> = {}
  for (const key of keys) ordered[key] = value[key]
  return JSON.stringify(ordered)
}

/** Top-level envelope payload must match enqueue payload (immutable operation identity). */
export function envelopePayloadRefsConsistent(envelope: WorkflowOutboxEnvelope): boolean {
  return stableJson(envelope.payloadRef) === stableJson(envelope.enqueue.payloadRef)
}

export function workflowJobMatchesOutboxEnvelope(
  job: Pick<
    WorkflowJob,
    'idempotencyKey' | 'requestFingerprint' | 'customerAccountId' | 'jobKind' | 'sourceType' | 'sourceId'
  >,
  envelope: WorkflowOutboxEnvelope,
): boolean {
  if (job.idempotencyKey !== envelope.enqueue.idempotencyKey) return false
  if (job.requestFingerprint !== canonicalEnqueueFingerprint(envelope.enqueue)) return false
  if ((job.customerAccountId ?? null) !== (envelope.enqueue.customerAccountId ?? null)) return false
  if (job.jobKind !== envelope.enqueue.jobKind) return false
  if (job.sourceType !== envelope.enqueue.sourceType) return false
  if (job.sourceId !== envelope.enqueue.sourceId) return false
  return true
}

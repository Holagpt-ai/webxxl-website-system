import { createHash } from 'crypto'
import type { EnqueueWorkflowJobInput } from '@/lib/platform/workflow/types'

export function buildWorkflowRequestFingerprint(input: {
  customerAccountId?: string | null
  managedSiteId?: string | null
  billingGroupId?: string | null
  jobKind: string
  sourceType: string
  sourceId: string
  sourceRevisionHash?: string | null
  payloadRef: Record<string, unknown>
}): string {
  const payload = [
    input.customerAccountId ?? '',
    input.managedSiteId ?? '',
    input.billingGroupId ?? '',
    input.jobKind,
    input.sourceType,
    input.sourceId,
    input.sourceRevisionHash ?? '',
    stableJson(input.payloadRef),
  ].join('|')
  return createHash('sha256').update(payload).digest('hex')
}

export function buildEnqueueFingerprint(input: EnqueueWorkflowJobInput): string {
  return buildWorkflowRequestFingerprint({
    customerAccountId: input.customerAccountId,
    managedSiteId: input.managedSiteId,
    billingGroupId: input.billingGroupId,
    jobKind: input.jobKind,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    sourceRevisionHash: input.sourceRevisionHash,
    payloadRef: input.payloadRef,
  })
}

function stableJson(value: Record<string, unknown>): string {
  const keys = Object.keys(value).sort()
  const ordered: Record<string, unknown> = {}
  for (const key of keys) ordered[key] = value[key]
  return JSON.stringify(ordered)
}

import type { WorkflowJob } from '@prisma/client'
import type { WorkflowJobSnapshot } from '@/lib/platform/workflow/types'

export function mapWorkflowJob(row: WorkflowJob): WorkflowJobSnapshot {
  return {
    id: row.id,
    jobKind: row.jobKind,
    customerAccountId: row.customerAccountId,
    managedSiteId: row.managedSiteId,
    billingGroupId: row.billingGroupId,
    correlationId: row.correlationId,
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    sourceRevisionHash: row.sourceRevisionHash,
    idempotencyKey: row.idempotencyKey,
    requestFingerprint: row.requestFingerprint,
    status: row.status,
    priority: row.priority,
    scheduledAt: row.scheduledAt,
    nextAttemptAt: row.nextAttemptAt,
    attemptCount: row.attemptCount,
    maxAttempts: row.maxAttempts,
    leaseOwner: row.leaseOwner,
    leaseToken: row.leaseToken,
    leaseExpiresAt: row.leaseExpiresAt,
    leaseFence: row.leaseFence,
    lastErrorCode: row.lastErrorCode,
    lastErrorClass: row.lastErrorClass,
    resultRef: row.resultRef,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    completedAt: row.completedAt,
  }
}

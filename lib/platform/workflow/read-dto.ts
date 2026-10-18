import type { WorkflowJob } from '@prisma/client'

export type WorkflowRunListItemDto = {
  id: string
  jobKind: string
  status: string
  customerAccountId: string | null
  correlationId: string
  attemptCount: number
  maxAttempts: number
  lastErrorCode: string | null
  createdAt: string
  updatedAt: string
  completedAt: string | null
}

export type WorkflowSummaryDto = {
  queueDepth: number
  oldestJobAgeMs: number | null
  deadLetterCount: number
  expiredLeaseCount: number
}

export function toWorkflowRunListItem(row: WorkflowJob): WorkflowRunListItemDto {
  return {
    id: row.id,
    jobKind: row.jobKind,
    status: row.status,
    customerAccountId: row.customerAccountId,
    correlationId: row.correlationId,
    attemptCount: row.attemptCount,
    maxAttempts: row.maxAttempts,
    lastErrorCode: row.lastErrorCode,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
  }
}

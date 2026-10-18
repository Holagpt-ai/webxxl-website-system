import type { WorkflowEvent, WorkflowJob } from '@prisma/client'

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

export type WorkflowEventDto = {
  id: string
  eventType: string
  fromStatus: string | null
  toStatus: string | null
  createdAt: string
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

/** Omit lease tokens, raw payloads, and other sensitive detail from API responses. */
export function toSafeWorkflowEvent(row: WorkflowEvent): WorkflowEventDto {
  return {
    id: row.id,
    eventType: row.eventType,
    fromStatus: row.fromStatus,
    toStatus: row.toStatus,
    createdAt: row.createdAt.toISOString(),
  }
}

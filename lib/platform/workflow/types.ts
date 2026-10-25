import type { WorkflowErrorClass, WorkflowJobStatus } from '@prisma/client'

export type WorkflowJobKind =
  | 'COMMS_RECEIPT_PROCESS'
  | 'CRM_FOLLOWUP_EVALUATE'
  | 'SEO_SYNC_PREPARE'
  | 'ANALYTICS_PROVIDER_SYNC'
  | 'ANALYTICS_CONVERSION_AGGREGATE'
  | 'MARKETING_DRAFT_PREPARE'
  | 'SOCIAL_STATUS_RECONCILE'
  | 'WORKFORCE_TASK_PREPARE'
  | 'WALLET_RECONCILIATION_REVIEW'
  | 'NOTIFICATION_DELIVERY'
  | 'COMMERCE_PAYMENT_FULFILL'
  | 'COMMERCE_CREDIT_ISSUE_PREPARE'
  | 'COMMERCE_SERVICE_PROVISION_PREPARE'
  | 'COMMERCE_SUBSCRIPTION_LIFECYCLE'
  | 'COMMERCE_FULFILLMENT_RECOVERY'

export type WorkflowDomainError =
  | 'NOT_CONFIGURED'
  | 'IDEMPOTENCY_CONFLICT'
  | 'FORBIDDEN_TRANSITION'
  | 'LEASE_CONFLICT'
  | 'JOB_NOT_FOUND'
  | 'TENANT_MISMATCH'
  | 'UNAUTHORIZED'

export type WorkflowResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: WorkflowDomainError; message?: string }

export type WorkflowJobSnapshot = {
  id: string
  jobKind: string
  customerAccountId: string | null
  managedSiteId: string | null
  billingGroupId: string | null
  correlationId: string
  sourceType: string
  sourceId: string
  sourceRevisionHash: string | null
  idempotencyKey: string
  requestFingerprint: string
  status: WorkflowJobStatus
  priority: number
  scheduledAt: Date
  nextAttemptAt: Date
  attemptCount: number
  maxAttempts: number
  leaseOwner: string | null
  leaseToken: string | null
  leaseExpiresAt: Date | null
  leaseFence: number
  lastErrorCode: string | null
  lastErrorClass: WorkflowErrorClass | null
  resultRef: string | null
  createdAt: Date
  updatedAt: Date
  completedAt: Date | null
}

export type EnqueueWorkflowJobInput = {
  jobKind: WorkflowJobKind
  customerAccountId?: string | null
  managedSiteId?: string | null
  billingGroupId?: string | null
  correlationId: string
  sourceType: string
  sourceId: string
  sourceRevisionHash?: string | null
  idempotencyKey: string
  priority?: number
  scheduledAt?: Date
  maxAttempts?: number
  payloadRef: Record<string, unknown>
}

export type HandlerExecutionContext = {
  job: WorkflowJobSnapshot
  attemptNumber: number
  leaseToken: string
  leaseFence: number
  workerId: string
}

export type HandlerExecutionResult =
  | { outcome: 'COMPLETED'; resultRef?: string }
  | { outcome: 'RETRY'; errorClass: WorkflowErrorClass; errorCode: string; retryAfterMs?: number }
  | { outcome: 'AWAITING_RECONCILIATION'; errorCode: string; resultRef?: string }
  | { outcome: 'FAILED_TERMINAL'; errorClass: WorkflowErrorClass; errorCode: string }
  | { outcome: 'BLOCKED'; errorCode: string }

export { WorkflowErrorClass, WorkflowJobStatus }

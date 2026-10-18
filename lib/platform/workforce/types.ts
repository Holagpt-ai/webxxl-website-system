import type { ActorType } from '@/lib/platform/identity'

export type WorkforceTaskStatus =
  | 'DRAFT'
  | 'QUEUED'
  | 'AWAITING_APPROVAL'
  | 'AUTHORIZED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'PAUSED'
  | 'CANCELLED'

export type WorkforceExecutionPhase =
  | 'TASK_PREPARED'
  | 'TASK_AUTHORIZED'
  | 'PROVIDER_ACCEPTED'
  | 'WORK_IN_PROGRESS'
  | 'ARTIFACT_PRODUCED'
  | 'REVIEW_REQUIRED'
  | 'COMPLETED'

export type WorkforceApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'REVOKED'

export type WorkforcePauseScope = 'GLOBAL' | 'AGENT' | 'TASK' | 'PROVIDER'

export type InternalAgentDefinitionRecord = {
  id: string
  roleKey: string
  displayName: string
  configVersion: string
  riskTier: number
  providerAdapterKey: string
  liveExecutionEnabled: boolean
  paused: boolean
  allowedToolKeys: string[]
  deniedActions: string[]
  budgetLimitSubunits: number | null
  maxConcurrency: number
}

export type WorkforceTaskRecord = {
  id: string
  idempotencyKey: string
  correlationId?: string
  status: WorkforceTaskStatus
  executionPhase?: WorkforceExecutionPhase
  internalAgentKey: string
  requestedByUserId?: string
  customerAccountId?: string
  managedSiteId?: string
  projectId?: string
  capability: string
  inputArtifactRef?: string
  inputHash: string
  approvalRequired: boolean
  dependsOnTaskId?: string
  providerKey: string
  externalProviderRunId?: string
  externalProviderRef?: string
  resultArtifactRef?: string
  errorCode?: string
  errorClass?: string
  attemptCount: number
  createdAt: Date
  updatedAt: Date
  completedAt?: Date
}

export type WorkforceApprovalRecord = {
  id: string
  taskId: string
  status: WorkforceApprovalStatus
  approverUserId?: string
  capability: string
  artifactHash: string
  approvedScope?: Record<string, unknown>
  expiresAt: Date
  maxUses: number
  useCount: number
  decidedAt?: Date
  createdAt: Date
  updatedAt: Date
}

export type WorkforceBudgetUsageRecord = {
  id: string
  taskId?: string
  internalAgentKey: string
  idempotencyKey: string
  periodKey: string
  amountSubunits: number
  costSubunits: number
  tokenUnits: number
  reservedSubunits: number
  settledSubunits: number
  released: boolean
}

export type WorkforcePauseRecord = {
  id: string
  scope: WorkforcePauseScope
  targetKey: string
  active: boolean
  reason?: string
  setByUserId: string
  createdAt: Date
  releasedAt?: Date
}

export type WorkforceAuditRecord = {
  id: string
  taskId?: string
  actorUserId?: string
  actorType: ActorType | 'SYSTEM'
  eventKind: string
  detail?: Record<string, unknown>
  createdAt: Date
}

export type WorkforceToolCallRecord = {
  id: string
  taskId: string
  toolKey: string
  requestId: string
  replayKey: string
  inputHash: string
  approvalId?: string
  decision: 'ALLOWED' | 'DENIED'
  denialReason?: string
  customerAccountId?: string
  managedSiteId?: string
  actorId: string
  actorType: ActorType
}

export type WorkforceResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: string; message: string }

export type CreateWorkforceTaskInput = {
  idempotencyKey: string
  correlationId?: string
  internalAgentKey: string
  requestedByUserId?: string
  customerAccountId?: string
  managedSiteId?: string
  projectId?: string
  capability: string
  inputArtifactRef?: string
  inputPayload: unknown
  approvalRequired?: boolean
  dependsOnTaskId?: string
}

export type AuthorizeToolCallInput = {
  taskId: string
  actorId: string
  actorType: ActorType
  customerAccountId: string
  managedSiteId?: string
  toolKey: string
  requestId: string
  inputHash: string
  approvalId?: string
  at?: Date
}

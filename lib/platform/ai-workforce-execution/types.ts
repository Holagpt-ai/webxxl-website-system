export type AiWorkforceLocale = 'en' | 'es'

export type AiWorkforceDomain =
  | 'crm'
  | 'projects'
  | 'marketing'
  | 'seo'
  | 'communications'
  | 'knowledge'
  | 'billing'
  | 'forbidden'
  | 'other'

export type AiWorkforceEffect = 'READ' | 'DRAFT' | 'DENIED'

export type AiWorkforceCoverageState =
  | 'PREPARATION_ONLY'
  | 'CHANNEL_CONNECTED_PREPARATION_ONLY'
  | 'CHANNEL_DISCONNECTED'
  | 'COVERAGE_UNVERIFIED'
  | 'STORED_OR_UNVERIFIED'
  | 'DISPATCH_BLOCKED'
  | 'APPROVAL_REQUIRED'
  | 'PROPOSAL_ONLY'
  | 'APPROVED_SCOPE_ONLY'
  | 'QUOTE_ONLY'
  | 'REGISTRY_ONLY'
  | 'DENIED'
  | 'SOFT_CEILING'

export type AiWorkforcePreparationStatus =
  | 'PREPARED'
  | 'PENDING_APPROVAL'
  | 'APPROVED_EFFECT_BLOCKED'
  | 'REJECTED'

export type AiWorkforceResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: string; message: string }

export type ServerDataClassification = 'GENERAL_BUSINESS' | 'REGULATED_HEALTHCARE' | 'PHI'

export type WorkflowHandoffVisibility = {
  handler: 'WORKFORCE_TASK_PREPARE'
  registered: boolean
  state: 'NOT_QUEUED' | 'ENQUEUE_WITHHELD'
  reason: 'WORKFLOW_ENQUEUE_DISABLED' | 'BATCH6_DOES_NOT_DISPATCH'
  enqueueEnabled: boolean
  workerEnabled: boolean
  externalEffectsEnabled: boolean
  durablePilotEnabled: boolean
  attemptsExecuted: 0
  retryableErrorClasses: string[]
  nonRetryableErrorClasses: string[]
  idempotencyKey: string
  actionHash: string | null
}

export type AiWorkforcePreparation = {
  id: string
  customerAccountId: string
  managedSiteId: string | null
  actorUserId: string
  toolKey: string
  domain: AiWorkforceDomain
  locale: AiWorkforceLocale
  idempotencyKey: string
  requestFingerprint: string
  actionHash: string
  status: AiWorkforcePreparationStatus
  executionState: 'DISABLED'
  coverageState: AiWorkforceCoverageState
  customerChargeUsd: 0
  estimatedInternalSubunits: number
  outbound: 'BLOCKED'
  moneyEffect: 'NONE'
  liveInference: 'DISABLED'
  persistence: 'IN_MEMORY_PREPARATION'
  externalEffectCount: 0
  workflow: WorkflowHandoffVisibility
  draft: Record<string, unknown>
  approvalId: string | null
  approverUserId: string | null
  replayed: boolean
  createdAt: string
}

export type PrepareAccountWorkforceActionInput = {
  customerAccountId: string
  actorUserId: string
  toolKey: string
  idempotencyKey: string
  locale?: string
  managedSiteId?: string | null
  sourceRecordIds?: string[]
  /** Operating account for the signed-in user. Sibling billing-group accounts are denied. */
  operatingAccountId?: string
  targetAccountId?: string
  operatingMemberships?: Array<{ userId: string; customerAccountId: string }>
  billingGroupSiblingAccounts?: Map<string, string[]>
  /** Server-resolved only. HTTP routes must not copy this from the client body. */
  serverClassification?: ServerDataClassification
  channelConnected?: boolean | null
  untrustedPrompt?: string
  /** When true, the call is refused. Preparation never turns execution on. */
  liveExecutionRequested?: boolean
  costCeilingSubunits?: number
  softCeilingSubunits?: number
}

export type BindHumanApprovedActionInput = {
  customerAccountId: string
  preparationId: string
  approverUserId: string
  approvalId: string
  actionHash: string
  decision: 'APPROVED' | 'REJECTED'
}

export type AiWorkforceExecutionSlice<T> = {
  status: 'AVAILABLE' | 'UNAVAILABLE'
  sourceModule: string
  reasonCode?: string
  message?: string
  data?: T
}

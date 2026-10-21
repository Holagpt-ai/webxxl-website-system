import type { UserRole } from '@prisma/client'

export type CustomerAiActor = {
  userId: string
  platformRole: UserRole
}

export type CustomerAiError =
  | 'AI_WORKFORCE_DISABLED'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'TENANT_MISMATCH'
  | 'VALIDATION'
  | 'ENTITLEMENT_UNRESOLVED'
  | 'EXECUTION_DISABLED'
  | 'NOT_FOUND'
  | 'INVALID_TRANSITION'
  | 'POLICY_BLOCKED'
  | 'RATE_LIMITED'
  | 'EMERGENCY_DISABLED'

export type CustomerAiResult<T> = { ok: true; value: T } | { ok: false; error: CustomerAiError; message?: string }

export type EmployeeLifecycleStatus = 'DRAFT' | 'INACTIVE' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED'

export type KnowledgeStatus = 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'PUBLISHED' | 'ARCHIVED'

export type ChatSessionStatus = 'OPEN' | 'PAUSED' | 'CLOSED' | 'HANDOFF_PENDING' | 'HANDOFF_ACTIVE'

export type HandoffStatus = 'REQUESTED' | 'ASSIGNED' | 'ACCEPTED' | 'COMPLETED' | 'CANCELLED'

export type ToolAccessMode = 'READ' | 'WRITE'

export type CommsResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: CommsErrorCode; message: string }

export type CommsErrorCode =
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'CONFLICT'
  | 'VALIDATION'
  | 'NOT_CONFIGURED'
  | 'POLICY_UNRESOLVED'
  | 'COMMS_DISABLED'
  | 'QUARANTINED'
  | 'UNAUTHORIZED'

export type CommsPolicyDecision =
  | 'ALLOW_PREPARATION'
  | 'REQUIRES_APPROVAL'
  | 'DENIED'
  | 'NOT_CONFIGURED'
  | 'INSUFFICIENT_CREDITS'
  | 'COMPLIANCE_REVIEW_REQUIRED'
  | 'COST_UNAVAILABLE'

export type CommsConversationFilter =
  | 'open'
  | 'pending'
  | 'resolved'
  | 'assigned_to_me'
  | 'unassigned'
  | 'needs_attention'

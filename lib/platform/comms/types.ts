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
  | 'FREE_SOFTWARE_NOT_ELIGIBLE'
  | 'SUBSCRIPTION_EVIDENCE_UNAVAILABLE'
  | 'LEGACY_EVIDENCE_AMBIGUOUS'
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
  | 'assigned'
  | 'assigned_to_me'
  | 'unassigned'
  | 'needs_attention'

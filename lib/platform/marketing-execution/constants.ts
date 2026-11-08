export const MARKETING_EXECUTION_SOURCE_MODULES = [
  'marketing.workflow_counts',
  'marketing.review_evidence',
  'marketing.crm_audience_planning',
  'marketing.social_provider_readiness',
  'marketing.social_handoff_policy',
] as const

export const MARKETING_EXECUTION_PROVENANCE_NOTICE =
  'Marketing execution summary is planning and readiness only. CRM audience figures are not send authorization. Social scheduling remains dispatch-blocked unless separate owner activation gates are on. PUBLISHED counts require stored publication proof with release URL — queue or intent state is not publication.'

export const MARKETING_EXECUTION_PLANNING_DISCLOSURE =
  'Audience planning references are point-in-time consent snapshots. Outbound execution requires fresh evaluation and explicit approval workflows.'

/** Execution summary never authorizes live dispatch — flags are reported for owner visibility only. */
export const PREPARATION_ONLY_DISPATCH_BLOCKED_CODE = 'PREPARATION_ONLY_DISPATCH_BLOCKED'

export const PREPARATION_ONLY_DISPATCH_BLOCKED_MESSAGE =
  'Marketing execution summary is preparation-only; provider dispatch remains blocked on this route regardless of environment flag values'

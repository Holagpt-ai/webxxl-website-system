export const COMMS_EXECUTION_SOURCE_MODULES = [
  'comms.inbox_visibility',
  'comms.chatwoot_readiness',
  'comms.messaging_provider_readiness',
  'comms.wallet_group_boundary',
  'comms.outbound_policy_gates',
  'comms.dispatch_policy',
] as const

export const COMMS_EXECUTION_PROVENANCE_NOTICE =
  'Communications execution summary is readiness and policy preparation only. Inbox and Chatwoot slices are not send authorization. Shared billing-group wallet membership does not grant sibling CRM, conversation, or consent access. Live SMS/email/Chatwoot dispatch remains blocked unless separate owner activation gates are on.'

export const COMMS_EXECUTION_PLANNING_DISCLOSURE =
  'Consent and suppression figures are point-in-time. Outbound preparation requires fresh server-side evaluation, sender eligibility, immutable approval evidence, and WebXXL-owned wallet reservation. Chatwoot must not bypass the WebXXL messaging gateway.'

/** Execution summary never authorizes live dispatch — flags are reported for owner visibility only. */
export const PREPARATION_ONLY_DISPATCH_BLOCKED_CODE = 'PREPARATION_ONLY_DISPATCH_BLOCKED'

export const PREPARATION_ONLY_DISPATCH_BLOCKED_MESSAGE =
  'Communications execution summary is preparation-only; provider dispatch remains blocked on this route regardless of environment flag values'

export const COMMS_EXECUTION_BATCH_VERSION = 'batch4-comms-messaging-wallet-v1' as const

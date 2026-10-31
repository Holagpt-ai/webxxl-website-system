/** Batch 27A — read-only Business Command Center overview (account-scoped). */

export const BUSINESS_OVERVIEW_MODULES = [
  'crm',
  'marketing',
  'local_seo',
  'communications',
  'website_projects',
] as const

export type BusinessOverviewModule = (typeof BUSINESS_OVERVIEW_MODULES)[number]

/** Honest module readiness — never map disabled modules to zero counts. */
export type BusinessModuleReadiness =
  | { state: 'available'; empty: boolean; sourceCheckedAt: string; evidenceCount: number }
  | { state: 'disabled'; reasonCode: string; message: string }
  | { state: 'not_configured'; reasonCode: string; message: string }
  | { state: 'policy_unresolved'; reasonCode: string; message: string }
  | { state: 'not_eligible'; reasonCode: string; message: string }
  | { state: 'unauthorized'; reasonCode: string; message: string }
  | { state: 'unavailable'; reasonCode: string; message: string }

export type BusinessActionPriority = 'high' | 'medium' | 'normal' | 'low'

/** Stable action taxonomy for UI copy keys (English/Spanish labels live in v0). */
export type BusinessActionType =
  | 'crm.task.overdue'
  | 'crm.task.open'
  | 'crm.deal.open'
  | 'crm.merge.pending'
  | 'crm.website_lead.awaiting_review'
  | 'crm.website_lead.duplicate_review'
  | 'marketing.request.draft'
  | 'marketing.review.pending'
  | 'marketing.artifact.prepared'
  | 'local_seo.opportunity.actionable'
  | 'communications.conversation.needs_attention'
  | 'communications.inbox.setup'
  | 'website_projects.approval.pending'
  | 'website_projects.dependency.open'

export type BusinessRecordRef = {
  kind: string
  id: string
}

export type BusinessNavigationDestination = {
  /** Locale-neutral dashboard path (English unprefixed). UI prefixes `/es` when needed. */
  path: string
}

export type BusinessOverviewAction = {
  module: BusinessOverviewModule
  actionType: BusinessActionType
  recordRef: BusinessRecordRef
  priority: BusinessActionPriority
  /** Short customer-facing title from source record (not invented). */
  title: string
  destination: BusinessNavigationDestination
  /** Primary sort/evidence time (ISO-8601). */
  timestamp: string
  dueAt: string | null
  customerAccountId: string
}

/** Numeric summary with explicit total vs capped-sample semantics (Batch 27A.1). */
export type BusinessSummaryMetric = {
  value: number
  scope: 'account_total' | 'bounded_sample'
}

export type BusinessOverviewModuleSnapshot = {
  module: BusinessOverviewModule
  readiness: BusinessModuleReadiness
  /** Present only when `readiness.state === 'available'`. */
  summary?: Record<string, BusinessSummaryMetric>
  /** Batch 30A — managed-site lead funnel reporting attached to CRM (independent readiness). */
  websiteLeadReporting?: {
    readiness: BusinessModuleReadiness
    summary?: Record<string, BusinessSummaryMetric>
  }
}

export type BusinessOverviewResponse = {
  customerAccountId: string
  generatedAt: string
  accountScope: 'session_membership'
  modules: BusinessOverviewModuleSnapshot[]
  actions: BusinessOverviewAction[]
  limits: {
    maxActionsReturned: number
    maxActionsPerModule: number
  }
}

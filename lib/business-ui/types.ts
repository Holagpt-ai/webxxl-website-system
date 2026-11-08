/**
 * Browser-safe shapes for `GET /api/v1/business/overview`
 * (docs/platform/docs/BATCH27A-BUSINESS-COMMAND-CENTER-API-CONTRACT.md). Nothing imports `@/lib/platform/**`.
 */
import { localizePath } from '@/lib/i18n/localize'
import type { Locale } from '@/lib/i18n/config'

export const BUSINESS_API = {
  overview: '/api/v1/business/overview',
  /** Batch 1 (`BATCH1-CUSTOMER-OPERATIONS-API-CONTRACT.md`); embeds the full overview as `businessOverview`. */
  customerOperations: '/api/v1/customer-operations/summary',
} as const

export const BUSINESS_MODULES = ['crm', 'marketing', 'local_seo', 'communications', 'website_projects'] as const
export type BusinessModule = (typeof BUSINESS_MODULES)[number]

export function isBusinessModule(value: unknown): value is BusinessModule {
  return typeof value === 'string' && (BUSINESS_MODULES as readonly string[]).includes(value)
}

export type ReadinessState =
  | 'available'
  | 'disabled'
  | 'not_configured'
  | 'policy_unresolved'
  | 'not_eligible'
  | 'unauthorized'
  | 'unavailable'

export type ModuleReadiness =
  | { state: 'available'; empty: boolean; sourceCheckedAt: string; evidenceCount: number }
  | { state: Exclude<ReadinessState, 'available'>; reasonCode: string; message: string }

export type SummaryMetric = { value: number; scope: 'account_total' | 'bounded_sample' }

export type ModuleSnapshot = {
  module: BusinessModule
  readiness: ModuleReadiness
  summary?: Record<string, SummaryMetric>
  websiteLeadReporting?: {
    readiness: ModuleReadiness
    summary?: Record<string, SummaryMetric>
  }
}

export type ActionPriority = 'high' | 'medium' | 'normal' | 'low'

export type BusinessAction = {
  module: BusinessModule
  actionType: string
  recordRef: { kind: string; id: string }
  priority: ActionPriority
  title: string
  destination: { path: string }
  timestamp: string
  dueAt: string | null
  customerAccountId: string
}

export type BusinessOverview = {
  customerAccountId: string
  generatedAt: string
  accountScope: 'session_membership'
  modules: ModuleSnapshot[]
  actions: BusinessAction[]
  limits: { maxActionsReturned: number; maxActionsPerModule: number }
}

export type BusinessOverviewResponse = { overview: BusinessOverview }

export type OperationsCrmLinkage = {
  contactId: string
  openDeals: number
  openTasks: number
  destination: { path: string }
}

export type OperationsProjectContext = {
  projectId: string
  projectName: string
  progressPercent: number
  estimatedCompletionDate: string | null
  pendingApprovals: number
  openDependencies: number
  nextMilestoneTitle: string | null
  destination: { path: string }
}

export type OperationsLeadLineage = {
  leadId: string
  status: string
  managedSiteId: string
  managedSiteName: string | null
  submittedAt: string
  qualification: { qualifiedAt: string | null; convertedAt: string | null; rejectedAt: string | null }
  crm: OperationsCrmLinkage | null
  project: OperationsProjectContext | null
  destinations: { leadReview: { path: string } }
}

export type CustomerOperationsSummary = {
  customerAccountId: string
  generatedAt: string
  accountScope: 'session_membership'
  /** The inner overview object, not `{ overview }`. */
  businessOverview: BusinessOverview
  leadPipeline: { readiness: ModuleReadiness; summary?: Record<string, SummaryMetric> }
  /** Bounded sample of the most recent leads, never an account total. */
  recentLineage: OperationsLeadLineage[]
  navigation: { businessCommandCenter: string; crmLeads: string; crmFunnel: string; projectDashboard: string }
}

export type CustomerOperationsResponse = { summary: CustomerOperationsSummary }

/** Mirrors `CUSTOMER_OPERATIONS_MAX_LINEAGE`; used only to describe the sample. */
export const OPERATIONS_MAX_LINEAGE = 8

export const LEAD_PIPELINE_TOTAL = 'websiteLeadsReceived'
/** Lifecycle totals in display order. Awaiting review already includes duplicate review, so these never sum to the total. */
export const LEAD_PIPELINE_METRICS = [
  'websiteLeadsAwaitingReview',
  'websiteLeadsQualified',
  'websiteLeadsConverted',
  'websiteLeadsDuplicateReview',
] as const

const READINESS_STATES: readonly ReadinessState[] = [
  'available',
  'disabled',
  'not_configured',
  'policy_unresolved',
  'not_eligible',
  'unauthorized',
  'unavailable',
]

/** An unrecognised or malformed readiness is treated as unavailable rather than guessed. */
export function normalizeReadiness(value: unknown): ModuleReadiness {
  const r = value as Partial<Record<string, unknown>> | null | undefined
  const state = r?.state
  if (typeof state !== 'string' || !(READINESS_STATES as readonly string[]).includes(state)) {
    return { state: 'unavailable', reasonCode: 'READINESS_MISSING', message: '' }
  }
  if (state === 'available') {
    return {
      state,
      empty: r?.empty === true,
      sourceCheckedAt: typeof r?.sourceCheckedAt === 'string' ? r.sourceCheckedAt : '',
      evidenceCount: finiteCount(r?.evidenceCount) ?? 0,
    }
  }
  return {
    state: state as Exclude<ReadinessState, 'available'>,
    reasonCode: typeof r?.reasonCode === 'string' ? r.reasonCode : '',
    message: typeof r?.message === 'string' ? r.message : '',
  }
}

export function finiteCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}

/** Headline metrics per module, in display order. Only `account_total` values are ever shown as totals. */
export const HEADLINE_METRICS: Record<BusinessModule, readonly string[]> = {
  crm: ['openTasks', 'openDeals', 'pendingMerges'],
  marketing: ['draftRequests', 'pendingReviews', 'preparedArtifacts'],
  local_seo: ['actionableOpportunities'],
  communications: ['inboxes', 'needsAttentionConversations'],
  website_projects: ['pendingApprovals', 'openDependencies'],
}

/** Existing workspace for each module (locale-neutral). */
export const MODULE_WORKSPACE_PATH: Record<BusinessModule, string> = {
  crm: '/dashboard/crm',
  marketing: '/dashboard/marketing',
  local_seo: '/dashboard/seo',
  communications: '/dashboard/communications',
  website_projects: '/dashboard/project',
}

export function totalMetric(summary: ModuleSnapshot['summary'], key: string): number | null {
  const metric = summary?.[key]
  if (!metric || metric.scope !== 'account_total' || typeof metric.value !== 'number' || !Number.isFinite(metric.value)) {
    return null
  }
  return metric.value
}

/** A module the backend did not return is unavailable, never zero. */
export function snapshotFor(modules: ModuleSnapshot[], module: BusinessModule): ModuleSnapshot {
  return (
    modules.find((m) => m.module === module) ?? {
      module,
      readiness: { state: 'unavailable', reasonCode: 'MODULE_MISSING', message: '' },
    }
  )
}

const DASHBOARD_PATH = /^\/dashboard(?:[/?#]|$)/
const TRAVERSAL = /(^|\/)\.{1,2}(\/|\?|#|$)/

/**
 * Backend destinations are locale-neutral. Only internal customer-dashboard routes are linked;
 * anything else (absolute URLs, protocol-relative paths, traversal) returns null and renders unlinked.
 */
export function safeDestination(locale: Locale, path: unknown): string | null {
  if (typeof path !== 'string' || !DASHBOARD_PATH.test(path)) return null
  if (path.includes('//') || path.includes('\\') || TRAVERSAL.test(path)) return null
  return localizePath(locale, path)
}

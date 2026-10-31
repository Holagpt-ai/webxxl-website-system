/**
 * Browser-safe types and helpers for the Batch 28B Lead Inbox.
 * Shapes follow `BATCH28A-MANAGED-SITE-LEADS-API-CONTRACT.md`; nothing here imports `@/lib/platform/**`.
 */
import type { WorkspaceError } from './workspace'

export const LEAD_STATUSES = [
  'RECEIVED',
  'PENDING_REVIEW',
  'QUALIFIED',
  'REJECTED',
  'CONVERTED',
  'DUPLICATE_REVIEW',
] as const

export type LeadStatus = (typeof LEAD_STATUSES)[number]

export type SiteLead = {
  id: string
  managedSiteId: string
  status: LeadStatus
  locale: string
  formReference: string | null
  submittedAt: string
  contactName: string | null
  contactEmail: string
  contactPhone: string | null
  message: string | null
  duplicateOfLeadId: string | null
  crmContactId: string | null
  convertedAt: string | null
  createdAt: string
}

export type LeadListResponse = { leads: SiteLead[]; nextCursor?: string; sampleLimit: number }
export type LeadDetailResponse = { lead: SiteLead }

export type LeadSummaryMetric = { value: number; scope: 'account_total' | 'bounded_sample' }
export type LeadSummaryResponse = {
  summary: Record<string, LeadSummaryMetric | undefined>
  attribution: { managedSiteId?: string; sourceSystem: string }
}

/** `inboxSample` is a bounded sample, so it is intentionally not listed as a total. */
export const LEAD_SUMMARY_KEYS = [
  'leadsReceived',
  'awaitingReview',
  'qualified',
  'converted',
  'rejected',
  'duplicateReview',
] as const

export type LeadSummaryKey = (typeof LEAD_SUMMARY_KEYS)[number]

export type LeadTransition = 'pendingReview' | 'qualify' | 'reject' | 'convert'

/** Mirrors the backend `allowedFrom` lists. The backend stays the final authority and answers 409 otherwise. */
export const LEAD_TRANSITION_FROM: Record<LeadTransition, readonly LeadStatus[]> = {
  pendingReview: ['RECEIVED', 'DUPLICATE_REVIEW'],
  qualify: ['RECEIVED', 'PENDING_REVIEW', 'DUPLICATE_REVIEW'],
  reject: ['RECEIVED', 'PENDING_REVIEW', 'QUALIFIED', 'DUPLICATE_REVIEW'],
  // Duplicate review is excluded on purpose: a possible duplicate is never converted or merged implicitly.
  convert: ['QUALIFIED', 'PENDING_REVIEW'],
}

export function canTransition(action: LeadTransition, status: LeadStatus): boolean {
  return LEAD_TRANSITION_FROM[action].includes(status)
}

const ACTION_PATHS: Record<LeadTransition, string> = {
  pendingReview: 'pending-review',
  qualify: 'qualify',
  reject: 'reject',
  convert: 'convert',
}

export const LEADS_API = {
  list: '/api/v1/site-leads',
  summary: '/api/v1/site-leads/summary',
  lead: (id: string) => `/api/v1/site-leads/${encodeURIComponent(id)}`,
  action: (id: string, action: LeadTransition) => `/api/v1/site-leads/${encodeURIComponent(id)}/${ACTION_PATHS[action]}`,
}

export const LEAD_LIST_TAKE = 25
export const REJECT_REASON_MAX = 500

export type TransitionResult = { id: string; status: LeadStatus }
export type ConvertResult = { leadId: string; contactId: string; status: 'CONVERTED' }

/**
 * A lead-specific reading of an API failure. Codes are checked before HTTP statuses because the
 * module and eligibility gates all answer 503, which must not read as a generic outage.
 */
export type LeadIssue =
  | 'intakeDisabled'
  | 'crmDisabled'
  | 'ineligible'
  | 'policyUnresolved'
  | 'unauthorized'
  | 'forbidden'
  | 'notFound'
  | 'rateLimited'
  | 'unavailable'
  | 'statusConflict'
  | 'identityConflict'
  | 'conversionPending'
  | 'conflict'
  | 'validation'
  | 'error'

export function leadIssue(error: WorkspaceError): LeadIssue {
  switch (error.code) {
    case 'SITE_LEAD_INTAKE_DISABLED':
      return 'intakeDisabled'
    case 'CRM_DISABLED':
      return 'crmDisabled'
    case 'FREE_SOFTWARE_NOT_ELIGIBLE':
      return 'ineligible'
    case 'POLICY_UNRESOLVED':
    case 'SUBSCRIPTION_EVIDENCE_UNAVAILABLE':
    case 'LEGACY_EVIDENCE_AMBIGUOUS':
    case 'NOT_CONFIGURED':
      return 'policyUnresolved'
  }
  const { status } = error
  const detail = error.detail ?? ''
  if (status === 401 || error.code === 'UNAUTHORIZED') return 'unauthorized'
  if (status === 403 || error.code === 'FORBIDDEN') return 'forbidden'
  if (status === 404 || error.code === 'NOT_FOUND') return 'notFound'
  if (status === 429 || error.code === 'RATE_LIMIT') return 'rateLimited'
  if (status === 409 || error.code === 'CONFLICT') {
    if (/identity/i.test(detail) && !/idempotency/i.test(detail)) return 'identityConflict'
    if (/in progress|concurrent conversion/i.test(detail)) return 'conversionPending'
    if (/transition|must be qualified/i.test(detail)) return 'statusConflict'
    return 'conflict'
  }
  if (status === 400 || error.code === 'VALIDATION') return 'validation'
  if (status === 0 || status >= 500) return 'unavailable'
  return 'error'
}

/** Issues that apply to the whole inbox, so the page shows one state instead of empty regions. */
export const GATE_ISSUES: ReadonlySet<LeadIssue> = new Set([
  'intakeDisabled',
  'crmDisabled',
  'ineligible',
  'policyUnresolved',
  'unauthorized',
  'forbidden',
])

/** A retry with the same idempotency key is only safe when the attempt may not have reached the server. */
export function isRetryableIssue(issue: LeadIssue): boolean {
  return issue === 'unavailable' || issue === 'rateLimited' || issue === 'conversionPending' || issue === 'error'
}

/** Date inputs give local calendar days; the API filters on instants. */
export function dayStartIso(day: string): string | null {
  if (!day) return null
  const date = new Date(`${day}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export function dayEndIso(day: string): string | null {
  if (!day) return null
  const date = new Date(`${day}T23:59:59.999`)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

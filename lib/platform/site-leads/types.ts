import type { ManagedSiteLeadStatus } from '@prisma/client'

export type SiteLeadResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: SiteLeadErrorCode; message: string }

export type SiteLeadErrorCode =
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'CONFLICT'
  | 'VALIDATION'
  | 'NOT_CONFIGURED'
  | 'SITE_LEAD_INTAKE_DISABLED'
  | 'UNAUTHORIZED'
  | 'RATE_LIMIT'
  | 'PAYLOAD_TOO_LARGE'
  | 'CRM_DISABLED'
  | 'POLICY_UNRESOLVED'
  | 'FREE_SOFTWARE_NOT_ELIGIBLE'
  | 'SUBSCRIPTION_EVIDENCE_UNAVAILABLE'
  | 'LEGACY_EVIDENCE_AMBIGUOUS'

export type SiteLeadSummaryMetric = {
  value: number
  scope: 'account_total' | 'bounded_sample'
}

export type SiteLeadInboxRow = {
  id: string
  managedSiteId: string
  status: ManagedSiteLeadStatus
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

export const SITE_LEAD_TERMINAL_STATUSES: ReadonlySet<ManagedSiteLeadStatus> = new Set([
  'REJECTED',
  'CONVERTED',
])

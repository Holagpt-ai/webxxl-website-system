/** Only the Prisma JSON keys the CRM screens read. Dates arrive as ISO strings. */

export type CrmChannelIdentity = {
  id: string
  identityType: string
  displayValue: string
  verificationState: string
  isPrimary: boolean
}

export type CrmContact = {
  id: string
  status: string
  givenName: string | null
  familyName: string | null
  preferredName: string | null
  organizationName: string | null
  jobTitle: string | null
  locale: string
  city: string | null
  leadSource: string | null
  lastActivityAt: string | null
  createdAt: string
  updatedAt: string
  channelIdentities?: CrmChannelIdentity[]
}

export type CrmCompany = {
  id: string
  name: string
  websiteDomain: string | null
  industry: string | null
  createdAt: string
}

export type CrmPipelineStage = { id: string; name: string; sortOrder: number; probabilityBps: number | null }

export type CrmPipeline = { id: string; name: string; isDefault: boolean; stages: CrmPipelineStage[] }

export type CrmDeal = {
  id: string
  pipelineId: string
  stageId: string
  contactId: string | null
  companyId: string | null
  title: string
  status: string
  amountMinorUnits: number | null
  currencyCode: string
  expectedCloseAt: string | null
  updatedAt: string
}

export type CrmTask = {
  id: string
  title: string
  status: string
  priority: string
  dueAt: string | null
  completedAt?: string | null
  disposition?: string | null
  contactId: string | null
  dealId: string | null
  createdAt: string
}

export const TASK_STATUSES = ['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const
export const TASK_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const

/** The backend rejects any status change once a task is completed or cancelled. */
export function isTerminalTask(status: string): boolean {
  return status === 'COMPLETED' || status === 'CANCELLED'
}

export type CrmTaskPatch = {
  title?: string
  status?: string
  priority?: string
  dueAt?: string | null
  disposition?: string | null
}

export type CrmConsentEvidence = { id: string; evidenceRef: string; capturedAt: string }

export type CrmConsent = {
  id: string
  channel: string
  purpose: string
  status: string
  source: string
  termsVersion: string | null
  jurisdiction: string | null
  capturedAt: string
  revokedAt: string | null
  expiresAt: string | null
  evidence?: CrmConsentEvidence[]
}

export type CrmSuppression = {
  id: string
  channel: string
  purpose: string
  reason: string
  source: string
  active: boolean
  createdAt: string
}

export type CrmConsentState = { consents: CrmConsent[]; suppressions: CrmSuppression[] }

export type CrmContactPage = { contacts: CrmContact[]; nextCursor?: string }

/** Backend bound for `q`. */
export const CRM_SEARCH_MAX = 120

export type CrmSegment = {
  id: string
  name: string
  kind: string
  createdAt: string
  updatedAt: string
  /** Present on dynamic segments. Treated as untrusted until parsed by the builder. */
  filterDefinition?: unknown
}

export type CrmTimelineEvent = {
  id: string
  eventKind: string
  eventAt: string
  channel: string | null
  direction: string | null
  disposition: string | null
  sourceSystem: string
}

export type SegmentRuleField =
  | 'tag'
  | 'leadSource'
  | 'createdAfter'
  | 'createdBefore'
  | 'lastActivityBefore'
  | 'hasOpenDeal'
  | 'followUpCoverage'
  | 'consentEligible'
  | 'notSuppressed'

export type SegmentOperator = 'eq' | 'neq' | 'gte' | 'lte' | 'in'

export type SegmentRule = { field: SegmentRuleField; operator: SegmentOperator; value: unknown }

export type SegmentFilterDefinition = { logic: 'AND' | 'OR'; rules: SegmentRule[] }

export type SegmentPopulationSummary = {
  totalContacts: number
  eligibleContacts: number
  suppressedContacts: number
  unknownConsentContacts: number
}

/** `matchedContacts`, `accountContactCount`, and `accountSummary` arrived in Batch 23; older responses omit them. */
export type SegmentEvaluation = {
  segmentId?: string
  contactIds: string[]
  matchedContacts?: number
  accountContactCount?: number
  summary: SegmentPopulationSummary
  accountSummary?: SegmentPopulationSummary
}

export type ImportRowDisposition =
  | { kind: 'ready' }
  | { kind: 'duplicate_existing'; contactId: string; normalizedEmail?: string; normalizedPhone?: string }
  | { kind: 'duplicate_in_file'; firstRowNumber: number; normalizedEmail?: string; normalizedPhone?: string }
  | { kind: 'rejected'; errors: string[] }
  | { kind: 'skipped'; reason: string }

export type ImportDispositionKind = ImportRowDisposition['kind']

export type ImportPreviewRow = {
  rowNumber: number
  disposition: ImportRowDisposition
  normalized: {
    email?: string
    emailNormalized?: string
    givenName?: string
    familyName?: string
    phoneNormalized?: string
    leadSource?: string
  }
}

export type ImportPreviewSummary = {
  ready: number
  duplicateExisting: number
  duplicateInFile: number
  rejected: number
  skipped: number
  rowCount: number
}

/** `summary` and `rows` arrived in Batch 23; the legacy keys stay so older jobs still render. */
export type ImportPreview = {
  jobId: string
  previewReport: {
    duplicates: { rowNumber: number; email: string }[]
    rowCount: number
    consentGranted: false
    summary?: ImportPreviewSummary
    rows?: ImportPreviewRow[]
  }
}

export type ImportCommitOutcome = {
  importedCount: number
  jobId: string
  committed?: number
  skipped?: number
  rejected?: number
  duplicates?: number
}

/** Backend mapping targets. The UI sends `{ target: column }`; the server also accepts the inverse. */
export const IMPORT_TARGETS = ['email', 'phone', 'givenName', 'familyName', 'leadSource'] as const
export type ImportTarget = (typeof IMPORT_TARGETS)[number]

export type CrmMergeProposal = {
  id: string
  primaryContactId: string
  duplicateContactId: string
  confidenceBps: number
  status: string
  createdAt: string
}

export const MERGE_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const

export type MergeApproval = { survivorContactId: string; mergedContactId: string }

export type ExportPage = { csv: string; nextCursor?: string }

export const CRM_API = {
  contacts: '/api/v1/crm/contacts',
  contact: (id: string) => `/api/v1/crm/contacts/${encodeURIComponent(id)}`,
  timeline: (id: string) => `/api/v1/crm/contacts/${encodeURIComponent(id)}/timeline`,
  consent: (id: string) => `/api/v1/crm/contacts/${encodeURIComponent(id)}/consent`,
  companies: '/api/v1/crm/companies',
  pipelines: '/api/v1/crm/pipelines',
  deals: '/api/v1/crm/deals',
  dealStage: (id: string) => `/api/v1/crm/deals/${encodeURIComponent(id)}/stage`,
  tasks: '/api/v1/crm/tasks',
  task: (id: string) => `/api/v1/crm/tasks/${encodeURIComponent(id)}`,
  segments: '/api/v1/crm/segments',
  segment: (id: string) => `/api/v1/crm/segments/${encodeURIComponent(id)}`,
  mergeProposals: '/api/v1/crm/merge-proposals',
  mergeProposal: (id: string) => `/api/v1/crm/merge-proposals/${encodeURIComponent(id)}`,
  importPreview: '/api/v1/crm/imports/preview',
  importCommit: '/api/v1/crm/imports/commit',
  exports: '/api/v1/crm/exports',
} as const

/** Fixed `take 50` lists and the default `take` on contacts. */
export const CRM_PAGE_SIZE = 50

export function contactName(contact: CrmContact, fallback: string): string {
  if (contact.preferredName) return contact.preferredName
  const full = [contact.givenName, contact.familyName].filter(Boolean).join(' ')
  if (full) return full
  const email = contact.channelIdentities?.find((c) => c.identityType === 'EMAIL')
  return email?.displayValue ?? fallback
}

export function primaryIdentity(contact: CrmContact, type: 'EMAIL' | 'PHONE'): string | null {
  const list = contact.channelIdentities?.filter((c) => c.identityType === type) ?? []
  return (list.find((c) => c.isPrimary) ?? list[0])?.displayValue ?? null
}

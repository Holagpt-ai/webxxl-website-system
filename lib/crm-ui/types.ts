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
  contactId: string | null
  dealId: string | null
  createdAt: string
}

export type CrmSegment = { id: string; name: string; kind: string; createdAt: string; updatedAt: string }

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

export type SegmentEvaluation = {
  contactIds: string[]
  summary: { totalContacts: number; eligibleContacts: number; suppressedContacts: number; unknownConsentContacts: number }
}

export type ImportPreview = {
  jobId: string
  previewReport: { duplicates: { rowNumber: number; email: string }[]; rowCount: number; consentGranted: false }
}

export type ExportPage = { csv: string; nextCursor?: string }

export const CRM_API = {
  contacts: '/api/v1/crm/contacts',
  contact: (id: string) => `/api/v1/crm/contacts/${encodeURIComponent(id)}`,
  timeline: (id: string) => `/api/v1/crm/contacts/${encodeURIComponent(id)}/timeline`,
  companies: '/api/v1/crm/companies',
  pipelines: '/api/v1/crm/pipelines',
  deals: '/api/v1/crm/deals',
  tasks: '/api/v1/crm/tasks',
  segments: '/api/v1/crm/segments',
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

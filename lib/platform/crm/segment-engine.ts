import type { CrmConsentChannel, CrmConsentPurpose, CrmConsentStatus } from '@prisma/client'

export type SegmentContactView = {
  id: string
  customerAccountId: string
  managedSiteId?: string | null
  leadSource?: string | null
  createdAt: Date
  lastActivityAt?: Date | null
  tagLabels: string[]
  hasOpenDeal?: boolean
  followUpCoverage?: string
  consents: { channel: CrmConsentChannel; purpose: CrmConsentPurpose; status: CrmConsentStatus }[]
  suppressions: { channel: CrmConsentChannel; purpose: CrmConsentPurpose; active: boolean }[]
}

export type SegmentFilterField =
  | 'tag'
  | 'leadSource'
  | 'createdAfter'
  | 'createdBefore'
  | 'lastActivityBefore'
  | 'hasOpenDeal'
  | 'followUpCoverage'
  | 'consentEligible'
  | 'notSuppressed'

export type SegmentFilterRule = {
  field: SegmentFilterField
  operator: 'eq' | 'neq' | 'gte' | 'lte' | 'in'
  value: string | boolean | string[]
}

export type SegmentFilterGroup = {
  logic: 'AND' | 'OR'
  rules: SegmentFilterRule[]
}

const ALLOWED_FIELDS = new Set<SegmentFilterField>([
  'tag',
  'leadSource',
  'createdAfter',
  'createdBefore',
  'lastActivityBefore',
  'hasOpenDeal',
  'followUpCoverage',
  'consentEligible',
  'notSuppressed',
])

export function validateSegmentFilterGroup(group: SegmentFilterGroup): { ok: true } | { ok: false; message: string } {
  if (group.logic !== 'AND' && group.logic !== 'OR') return { ok: false, message: 'Invalid filter logic' }
  for (const rule of group.rules) {
    if (!ALLOWED_FIELDS.has(rule.field)) return { ok: false, message: `Field not allowed: ${rule.field}` }
    if (!['eq', 'neq', 'gte', 'lte', 'in'].includes(rule.operator)) {
      return { ok: false, message: `Operator not allowed: ${rule.operator}` }
    }
  }
  return { ok: true }
}

function marketingConsentEligible(contact: SegmentContactView): boolean {
  const suppressed = contact.suppressions.some((s) => s.active && s.purpose === 'MARKETING' && s.channel === 'EMAIL')
  if (suppressed) return false
  const consent = contact.consents.find((c) => c.channel === 'EMAIL' && c.purpose === 'MARKETING')
  return consent?.status === 'GRANTED'
}

function ruleMatches(contact: SegmentContactView, rule: SegmentFilterRule): boolean {
  switch (rule.field) {
    case 'tag':
      return contact.tagLabels.includes(String(rule.value))
    case 'leadSource':
      return contact.leadSource === rule.value
    case 'createdAfter':
      return contact.createdAt >= new Date(String(rule.value))
    case 'createdBefore':
      return contact.createdAt <= new Date(String(rule.value))
    case 'lastActivityBefore':
      return !contact.lastActivityAt || contact.lastActivityAt <= new Date(String(rule.value))
    case 'hasOpenDeal':
      return Boolean(contact.hasOpenDeal) === Boolean(rule.value)
    case 'followUpCoverage':
      return contact.followUpCoverage === rule.value
    case 'consentEligible':
      return marketingConsentEligible(contact) === Boolean(rule.value)
    case 'notSuppressed':
      return !contact.suppressions.some((s) => s.active) === Boolean(rule.value)
    default:
      return false
  }
}

export function evaluateSegmentGroup(contact: SegmentContactView, group: SegmentFilterGroup): boolean {
  const results = group.rules.map((rule) => ruleMatches(contact, rule))
  return group.logic === 'AND' ? results.every(Boolean) : results.some(Boolean)
}

export function summarizeSegmentPopulation(contacts: SegmentContactView[]) {
  let eligible = 0
  let suppressed = 0
  let unknownConsent = 0
  for (const contact of contacts) {
    const hasSuppression = contact.suppressions.some((s) => s.active)
    if (hasSuppression) suppressed += 1
    const emailMarketing = contact.consents.find((c) => c.channel === 'EMAIL' && c.purpose === 'MARKETING')
    if (!emailMarketing || emailMarketing.status === 'UNKNOWN') unknownConsent += 1
    if (!hasSuppression && emailMarketing?.status === 'GRANTED') eligible += 1
  }
  return {
    totalContacts: contacts.length,
    eligibleContacts: eligible,
    suppressedContacts: suppressed,
    unknownConsentContacts: unknownConsent,
  }
}

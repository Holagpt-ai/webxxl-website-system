import { CRM_SEGMENT_MAX_RULES, CRM_SEGMENT_MAX_VALUE_LENGTH } from '@/config/crm-backend'
import type { CrmConsentChannel, CrmConsentPurpose, CrmConsentStatus } from '@prisma/client'

export type SegmentConsentRecord = {
  channel: CrmConsentChannel
  purpose: CrmConsentPurpose
  status: CrmConsentStatus
  capturedAt: Date
  revokedAt?: Date | null
}

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
  consents: SegmentConsentRecord[]
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

const FIELD_OPERATORS: Record<SegmentFilterField, ReadonlySet<SegmentFilterRule['operator']>> = {
  tag: new Set(['eq', 'neq', 'in']),
  leadSource: new Set(['eq', 'neq', 'in']),
  createdAfter: new Set(['eq', 'gte']),
  createdBefore: new Set(['eq', 'lte']),
  lastActivityBefore: new Set(['eq', 'lte']),
  hasOpenDeal: new Set(['eq', 'neq']),
  followUpCoverage: new Set(['eq', 'neq', 'in']),
  consentEligible: new Set(['eq']),
  notSuppressed: new Set(['eq']),
}

const DATE_FILTER_FIELDS = new Set<SegmentFilterField>(['createdAfter', 'createdBefore', 'lastActivityBefore'])
const BOOLEAN_FILTER_FIELDS = new Set<SegmentFilterField>(['hasOpenDeal', 'consentEligible', 'notSuppressed'])

export function parseSegmentFilterDate(value: string): Date | null {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

function normalizeInValues(value: SegmentFilterRule['value']): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean)
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
  }
  return []
}

function compareScalar<T>(actual: T, operator: SegmentFilterRule['operator'], expected: T, inValues?: string[]): boolean {
  switch (operator) {
    case 'eq':
      return actual === expected
    case 'neq':
      return actual !== expected
    case 'in':
      return inValues?.includes(String(actual)) ?? false
    case 'gte':
      return typeof actual === 'number' || actual instanceof Date
        ? (actual as Date | number) >= (expected as Date | number)
        : false
    case 'lte':
      return typeof actual === 'number' || actual instanceof Date
        ? (actual as Date | number) <= (expected as Date | number)
        : false
    default:
      return false
  }
}

export function effectiveMarketingConsentGranted(
  consents: SegmentConsentRecord[],
  suppressions: SegmentContactView['suppressions'],
  channel: CrmConsentChannel = 'EMAIL',
  purpose: CrmConsentPurpose = 'MARKETING',
): boolean {
  if (suppressions.some((row) => row.active && row.channel === channel && row.purpose === purpose)) {
    return false
  }
  const history = consents
    .filter((row) => row.channel === channel && row.purpose === purpose)
    .sort((a, b) => b.capturedAt.getTime() - a.capturedAt.getTime())
  const latest = history[0]
  if (!latest) return false
  if (latest.status === 'UNKNOWN') return false
  if (latest.status === 'REVOKED') return false
  if (latest.revokedAt && latest.revokedAt.getTime() <= Date.now()) return false
  return latest.status === 'GRANTED'
}

export function validateSegmentFilterGroup(group: SegmentFilterGroup): { ok: true } | { ok: false; message: string } {
  if (group.logic !== 'AND' && group.logic !== 'OR') return { ok: false, message: 'Invalid filter logic' }
  if (group.rules.length > CRM_SEGMENT_MAX_RULES) {
    return { ok: false, message: 'Segment filter rule limit exceeded' }
  }
  for (const rule of group.rules) {
    if (!ALLOWED_FIELDS.has(rule.field)) return { ok: false, message: `Field not allowed: ${rule.field}` }
    if (!FIELD_OPERATORS[rule.field].has(rule.operator)) {
      return { ok: false, message: `Operator ${rule.operator} is not supported for field ${rule.field}` }
    }
    const valueLength =
      typeof rule.value === 'string'
        ? rule.value.length
        : Array.isArray(rule.value)
          ? rule.value.join(',').length
          : 0
    if (valueLength > CRM_SEGMENT_MAX_VALUE_LENGTH) {
      return { ok: false, message: 'Segment filter value too long' }
    }
    if (BOOLEAN_FILTER_FIELDS.has(rule.field) && typeof rule.value !== 'boolean') {
      return { ok: false, message: `Field ${rule.field} requires a boolean value` }
    }
    if (rule.operator === 'in') {
      const values = normalizeInValues(rule.value)
      if (values.length === 0) return { ok: false, message: `Operator in requires at least one value for ${rule.field}` }
    }
    if (DATE_FILTER_FIELDS.has(rule.field) && typeof rule.value === 'string') {
      if (!parseSegmentFilterDate(rule.value)) {
        return { ok: false, message: `Invalid date for filter field: ${rule.field}` }
      }
    }
    if (rule.field === 'followUpCoverage' && typeof rule.value === 'string' && !rule.value.trim()) {
      return { ok: false, message: 'followUpCoverage filter requires a value' }
    }
  }
  return { ok: true }
}

function ruleMatches(contact: SegmentContactView, rule: SegmentFilterRule): boolean {
  const inValues = rule.operator === 'in' ? normalizeInValues(rule.value) : undefined

  switch (rule.field) {
    case 'tag': {
      const hasTag = contact.tagLabels.includes(String(rule.value))
      if (rule.operator === 'in') return contact.tagLabels.some((label) => inValues?.includes(label))
      if (rule.operator === 'neq') return !hasTag
      return hasTag
    }
    case 'leadSource': {
      const actual = contact.leadSource ?? ''
      if (rule.operator === 'in') return inValues?.includes(actual) ?? false
      return compareScalar(actual, rule.operator, String(rule.value))
    }
    case 'createdAfter': {
      const date = parseSegmentFilterDate(String(rule.value))
      if (!date) return false
      if (rule.operator === 'gte' || rule.operator === 'eq') return contact.createdAt >= date
      return false
    }
    case 'createdBefore': {
      const date = parseSegmentFilterDate(String(rule.value))
      if (!date) return false
      if (rule.operator === 'lte' || rule.operator === 'eq') return contact.createdAt <= date
      return false
    }
    case 'lastActivityBefore': {
      const date = parseSegmentFilterDate(String(rule.value))
      if (!date) return false
      if (rule.operator === 'lte' || rule.operator === 'eq') {
        return !contact.lastActivityAt || contact.lastActivityAt <= date
      }
      return false
    }
    case 'hasOpenDeal':
      return compareScalar(Boolean(contact.hasOpenDeal), rule.operator, Boolean(rule.value))
    case 'followUpCoverage': {
      const actual = contact.followUpCoverage ?? ''
      if (rule.operator === 'in') return inValues?.includes(actual) ?? false
      return compareScalar(actual, rule.operator, String(rule.value))
    }
    case 'consentEligible':
      return effectiveMarketingConsentGranted(contact.consents, contact.suppressions) === Boolean(rule.value)
    case 'notSuppressed':
      return compareScalar(
        !contact.suppressions.some((s) => s.active),
        rule.operator,
        Boolean(rule.value),
      )
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
    const granted = effectiveMarketingConsentGranted(contact.consents, contact.suppressions)
    const hasHistory = contact.consents.some((c) => c.channel === 'EMAIL' && c.purpose === 'MARKETING')
    if (!hasHistory || contact.consents.every((c) => c.status === 'UNKNOWN')) unknownConsent += 1
    if (!hasSuppression && granted) eligible += 1
  }
  return {
    totalContacts: contacts.length,
    matchedContacts: contacts.length,
    eligibleContacts: eligible,
    suppressedContacts: suppressed,
    unknownConsentContacts: unknownConsent,
  }
}

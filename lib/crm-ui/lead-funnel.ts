/**
 * Browser-safe types and helpers for the Batch 30B Lead Funnel dashboard.
 * Shapes follow `BATCH30A-LEAD-FUNNEL-REPORTING-API-CONTRACT.md`; nothing here imports `@/lib/platform/**`.
 */
import type { WorkspaceError } from './workspace'

export const FUNNEL_API = '/api/v1/site-leads/funnel-report'

/** Client-side mirrors of the backend defaults. The API stays authoritative and answers 400 otherwise. */
export const FUNNEL_MAX_RANGE_DAYS = 366
export const FUNNEL_MAX_GROUP_ROWS = 50

export type FunnelMetric = { value: number; scope: 'account_total' | 'bounded_sample' }

export type FunnelCounts = {
  leadsReceived: number
  awaitingReview: number
  qualified: number
  converted: number
  rejected: number
  duplicateReview: number
}

export type FunnelGroupRow = { key: string; counts: FunnelCounts }

export type FunnelReport = {
  customerAccountId: string
  generatedAt: string
  filters: { managedSiteId: string | null; formReference: string | null; createdFrom: string; createdTo: string }
  semantics: Record<string, string>
  summary: Record<string, FunnelMetric | undefined>
  conversionsInPeriod: FunnelMetric
  qualifiedEventsInPeriod: FunnelMetric
  rejectedEventsInPeriod: FunnelMetric
  byManagedSite: FunnelGroupRow[]
  byFormReference: FunnelGroupRow[]
  creationTrend: { date: string; leadsCreated: number }[]
  attribution: {
    state: 'verified_partial' | 'none'
    labelKeys: string[]
    analyticsEventLinkedLeads: number
    message: string
  }
}

export type FunnelReportResponse = { report: FunnelReport }

export const COHORT_KEYS = ['leadsReceived', 'awaitingReview', 'qualified', 'converted', 'rejected', 'duplicateReview'] as const
export type CohortKey = (typeof COHORT_KEYS)[number]

export const EVENT_KEYS = ['conversionsInPeriod', 'qualifiedEventsInPeriod', 'rejectedEventsInPeriod'] as const
export type EventKey = (typeof EVENT_KEYS)[number]

/** A metric is only shown as a number when the backend says it is a complete account count. */
export function totalOf(metric: FunnelMetric | undefined): number | null {
  return metric && metric.scope === 'account_total' ? metric.value : null
}

/**
 * Mutually exclusive lifecycle segments. The backend's `awaitingReview` already includes duplicate
 * review, so the "received or pending" segment subtracts it to keep the segments summing to the cohort.
 */
export const STATUS_SEGMENTS = ['pending', 'duplicateReview', 'qualified', 'converted', 'rejected'] as const
export type StatusSegment = (typeof STATUS_SEGMENTS)[number]

export function statusSegments(summary: FunnelReport['summary']): Record<StatusSegment, number> | null {
  const awaiting = totalOf(summary.awaitingReview)
  const duplicate = totalOf(summary.duplicateReview)
  const qualified = totalOf(summary.qualified)
  const converted = totalOf(summary.converted)
  const rejected = totalOf(summary.rejected)
  if (awaiting == null || duplicate == null || qualified == null || converted == null || rejected == null) return null
  return { pending: Math.max(0, awaiting - duplicate), duplicateReview: duplicate, qualified, converted, rejected }
}

/** The SQL trend only returns days that had leads; every other day in the range truly had zero. */
export function fillTrend(points: FunnelReport['creationTrend'], from: string, to: string) {
  const byDay = new Map(points.map((p) => [p.date, p.leadsCreated]))
  const start = parseDay(from)
  const end = parseDay(to)
  if (!start || !end || start > end) return points.map((p) => ({ date: p.date, value: p.leadsCreated }))
  const out: { date: string; value: number }[] = []
  for (let d = start; d <= end; d = new Date(d.getTime() + DAY_MS)) {
    const key = d.toISOString().slice(0, 10)
    out.push({ date: key, value: byDay.get(key) ?? 0 })
  }
  return out
}

const DAY_MS = 24 * 60 * 60 * 1000

function parseDay(day: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null
  const date = new Date(`${day}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

export type DateRangeProblem = 'order' | 'tooLong' | 'invalid'

/** Mirrors the backend range rules so an impossible request is explained before it is sent. */
export function checkDateRange(from: string, to: string, today = new Date()): DateRangeProblem | null {
  if (!from && !to) return null
  const toDate = to ? parseDay(to) : new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
  const fromDate = from ? parseDay(from) : toDate && new Date(toDate.getTime() - 30 * DAY_MS)
  if (!fromDate || !toDate) return 'invalid'
  if (fromDate > toDate) return 'order'
  if ((toDate.getTime() - fromDate.getTime()) / DAY_MS + 1 > FUNNEL_MAX_RANGE_DAYS + 1) return 'tooLong'
  return null
}

export type FunnelIssue =
  | 'crmDisabled'
  | 'ineligible'
  | 'notConfigured'
  | 'policyUnresolved'
  | 'unauthorized'
  | 'forbidden'
  | 'siteForbidden'
  | 'invalidDates'
  | 'rateLimited'
  | 'unavailable'

/**
 * Codes are read before HTTP statuses: every module gate answers 503, and must not read as an outage.
 * A 403 with a site filter is the backend rejecting that one site, not a missing permission.
 */
export function funnelIssue(error: WorkspaceError, siteFiltered: boolean): FunnelIssue {
  switch (error.code) {
    case 'CRM_DISABLED':
      return 'crmDisabled'
    case 'FREE_SOFTWARE_NOT_ELIGIBLE':
      return 'ineligible'
    case 'NOT_CONFIGURED':
      return 'notConfigured'
    case 'POLICY_UNRESOLVED':
    case 'SUBSCRIPTION_EVIDENCE_UNAVAILABLE':
    case 'LEGACY_EVIDENCE_AMBIGUOUS':
      return 'policyUnresolved'
    case 'VALIDATION':
      return 'invalidDates'
  }
  const { status } = error
  if (status === 401 || error.code === 'UNAUTHORIZED') return 'unauthorized'
  if (status === 403 || error.code === 'FORBIDDEN') {
    return siteFiltered && /managed site/i.test(error.detail ?? '') ? 'siteForbidden' : 'forbidden'
  }
  if (status === 400) return 'invalidDates'
  if (status === 429 || error.code === 'RATE_LIMIT') return 'rateLimited'
  return 'unavailable'
}

/** Access issues replace the whole dashboard so a disabled backend never renders zero-valued charts. */
export const FUNNEL_GATE_ISSUES: ReadonlySet<FunnelIssue> = new Set([
  'crmDisabled',
  'ineligible',
  'notConfigured',
  'policyUnresolved',
  'unauthorized',
  'forbidden',
])

export const RETRYABLE_FUNNEL_ISSUES: ReadonlySet<FunnelIssue> = new Set(['rateLimited', 'unavailable', 'policyUnresolved'])

export type SortKey = 'key' | keyof FunnelCounts
export type SortState = { key: SortKey; dir: 'asc' | 'desc' }

export function sortRows(rows: FunnelGroupRow[], sort: SortState, label: (key: string) => string): FunnelGroupRow[] {
  const sign = sort.dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const diff =
      sort.key === 'key' ? label(a.key).localeCompare(label(b.key)) : a.counts[sort.key] - b.counts[sort.key]
    return diff !== 0 ? diff * sign : label(a.key).localeCompare(label(b.key))
  })
}

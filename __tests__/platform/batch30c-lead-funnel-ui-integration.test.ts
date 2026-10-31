import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { crmLeadsEn } from '@/lib/i18n/dictionaries/crm-leads-en'
import { crmLeadsEs } from '@/lib/i18n/dictionaries/crm-leads-es'
import { crmLeadFunnelEn } from '@/lib/i18n/dictionaries/crm-lead-funnel-en'
import { crmWorkspaceEn } from '@/lib/i18n/dictionaries/crm-workspace-en'
import { crmWorkspaceEs } from '@/lib/i18n/dictionaries/crm-workspace-es'
import { localizePath } from '@/lib/i18n/localize'
import {
  COHORT_KEYS,
  EVENT_KEYS,
  FUNNEL_API,
  FUNNEL_GATE_ISSUES,
  FUNNEL_MAX_GROUP_ROWS,
  FUNNEL_MAX_RANGE_DAYS,
  checkDateRange,
  fillTrend,
  funnelIssue,
  sortRows,
  statusSegments,
  totalOf,
  type FunnelGroupRow,
  type FunnelReport,
} from '@/lib/crm-ui/lead-funnel'
import { WorkspaceError, withQuery } from '@/lib/crm-ui/workspace'

const err = (status: number, code: string, detail = '') =>
  new WorkspaceError(status, status === 503 ? 'DISABLED' : 'ERROR', code, detail || code)

function read(rel: string) {
  return readFileSync(join(process.cwd(), rel), 'utf8')
}

const syntheticReport = (over: Partial<FunnelReport> = {}): FunnelReport => ({
  customerAccountId: 'acct_test',
  generatedAt: '2026-10-31T12:00:00.000Z',
  filters: {
    managedSiteId: null,
    formReference: null,
    createdFrom: '2026-10-01',
    createdTo: '2026-10-03',
  },
  semantics: {},
  summary: {
    leadsReceived: { value: 10, scope: 'account_total' },
    awaitingReview: { value: 4, scope: 'account_total' },
    qualified: { value: 2, scope: 'account_total' },
    converted: { value: 3, scope: 'account_total' },
    rejected: { value: 1, scope: 'account_total' },
    duplicateReview: { value: 1, scope: 'account_total' },
  },
  conversionsInPeriod: { value: 1, scope: 'account_total' },
  qualifiedEventsInPeriod: { value: 2, scope: 'account_total' },
  rejectedEventsInPeriod: { value: 0, scope: 'account_total' },
  byManagedSite: [],
  byFormReference: [],
  creationTrend: [{ date: '2026-10-02', leadsCreated: 5 }],
  attribution: {
    state: 'none',
    labelKeys: [],
    analyticsEventLinkedLeads: 0,
    message: 'No verified attribution in this period.',
  },
  ...over,
})

describe('Batch 30C Lead Funnel UI integration', () => {
  it('registers Lead Funnel route and CRM subnav after Website Leads (EN/ES)', () => {
    expect(crmWorkspaceEn.nav.leadFunnel).toBe('Lead Funnel')
    expect(crmWorkspaceEs.nav.leadFunnel).toBe('Embudo de prospectos')
    const layout = read('app/[locale]/dashboard/crm/layout.tsx')
    expect(layout).toContain('`${base}/leads/funnel`')
    expect(layout).toContain('n.leadFunnel')
    expect(layout.indexOf('/leads`')).toBeLessThan(layout.indexOf('/leads/funnel'))
  })

  it('localizes funnel routes and loads account-scoped page props', () => {
    expect(localizePath('en', '/dashboard/crm/leads/funnel')).toBe('/dashboard/crm/leads/funnel')
    expect(localizePath('es', '/dashboard/crm/leads/funnel')).toBe('/es/dashboard/crm/leads/funnel')
    const page = read('app/[locale]/dashboard/crm/leads/funnel/page.tsx')
    expect(page).toContain('getCrmLeadsPageProps')
    expect(page).toContain('CrmLeadFunnelDashboard')
    const server = read('lib/crm-ui/server.ts')
    expect(server).toContain('requireCustomerMembership')
  })

  it('links Lead Inbox to Lead Funnel without breaking inbox APIs', () => {
    const inbox = read('components/crm/lead-inbox.tsx')
    expect(inbox).toContain('`${base}/leads/funnel`')
    expect(inbox).toContain('lc.funnelLink')
    expect(crmLeadsEn.funnelLink).toBe('Lead Funnel')
    expect(crmLeadsEs.funnelLink).toBe('Embudo de prospectos')
    const dashboard = read('components/crm/lead-funnel-dashboard.tsx')
    expect(dashboard).toContain('`${base}/leads`')
    expect(dashboard).toContain('fc.backToInbox')
  })

  it('builds funnel-report query params for site, form, and date filters', () => {
    expect(FUNNEL_API).toBe('/api/v1/site-leads/funnel-report')
    const url = withQuery(FUNNEL_API, {
      createdFrom: '2026-10-01',
      createdTo: '2026-10-31',
      managedSiteId: 'site_a',
      formReference: 'contact-main',
    })
    expect(url).toContain('createdFrom=2026-10-01')
    expect(url).toContain('createdTo=2026-10-31')
    expect(url).toContain('managedSiteId=site_a')
    expect(url).toContain('formReference=contact-main')
    const dash = read('components/crm/lead-funnel-dashboard.tsx')
    expect(dash).toContain('useWorkspace')
    expect(dash).toContain('accountId')
    expect(dash).toContain('customerAccountId === accountId')
  })

  it('separates cohort totals from event-time metrics and account_total scope', () => {
    expect(COHORT_KEYS).toContain('leadsReceived')
    expect(EVENT_KEYS).toContain('conversionsInPeriod')
    const metrics = read('components/crm/lead-funnel-metrics.tsx')
    expect(metrics).toContain('totalOf')
    expect(metrics).toContain('FunnelCohortMetrics')
    expect(metrics).toContain('FunnelEventMetrics')
    expect(totalOf({ value: 5, scope: 'account_total' })).toBe(5)
    expect(totalOf({ value: 5, scope: 'bounded_sample' })).toBeNull()
  })

  it('derives status segments without double-counting duplicate review in pending', () => {
    const report = syntheticReport()
    const segments = statusSegments(report.summary)
    expect(segments).toEqual({
      pending: 3,
      duplicateReview: 1,
      qualified: 2,
      converted: 3,
      rejected: 1,
    })
    const status = read('components/crm/lead-funnel-status.tsx')
    expect(status).toContain('statusSegments')
  })

  it('validates date range limits and zero-fills UTC daily trend labels', () => {
    expect(FUNNEL_MAX_RANGE_DAYS).toBe(366)
    expect(checkDateRange('2026-10-03', '2026-10-01')).toBe('order')
    expect(checkDateRange('2020-01-01', '2026-10-31')).toBe('tooLong')
    const filled = fillTrend([{ date: '2026-10-02', leadsCreated: 4 }], '2026-10-01', '2026-10-03')
    expect(filled.map((p) => p.date)).toEqual(['2026-10-01', '2026-10-02', '2026-10-03'])
    expect(filled.find((p) => p.date === '2026-10-01')?.value).toBe(0)
    const trend = read('components/crm/lead-funnel-trend.tsx')
    expect(trend).toContain('fillTrend')
    expect(trend).toContain('formatUtcDay')
  })

  it('enforces top-50 grouped breakdown display contract', () => {
    expect(FUNNEL_MAX_GROUP_ROWS).toBe(50)
    const breakdown = read('components/crm/lead-funnel-breakdown.tsx')
    expect(breakdown).toContain('FUNNEL_MAX_GROUP_ROWS')
    const rows: FunnelGroupRow[] = Array.from({ length: 51 }, (_, i) => ({
      key: `site_${i}`,
      counts: {
        leadsReceived: i,
        awaitingReview: 0,
        qualified: 0,
        converted: 0,
        rejected: 0,
        duplicateReview: 0,
      },
    }))
    expect(sortRows(rows.slice(0, 50), { key: 'leadsReceived', dir: 'desc' }, (k) => k).length).toBe(50)
  })

  it('maps disabled, ineligible, gate, and unavailable funnel issues', () => {
    expect(funnelIssue(err(503, 'CRM_DISABLED'), false)).toBe('crmDisabled')
    expect(funnelIssue(err(403, 'FREE_SOFTWARE_NOT_ELIGIBLE'), false)).toBe('ineligible')
    expect(funnelIssue(new WorkspaceError(503, 'NOT_CONFIGURED', 'NOT_CONFIGURED', ''), false)).toBe('notConfigured')
    expect(funnelIssue(err(500, 'ERROR', 'db'), false)).toBe('unavailable')
    expect(FUNNEL_GATE_ISSUES.has('crmDisabled')).toBe(true)
    const state = read('components/crm/lead-funnel-state.tsx')
    expect(state).toContain('FunnelIssueState')
    expect(state).toContain('RETRYABLE_FUNNEL_ISSUES')
    const dashboard = read('components/crm/lead-funnel-dashboard.tsx')
    expect(dashboard).toContain('FUNNEL_GATE_ISSUES')
    expect(dashboard).toContain('checkDateRange')
  })

  it('does not advertise fabricated ROI or sales conversion in funnel copy or attribution UI', () => {
    const en = JSON.stringify(crmLeadFunnelEn)
    expect(en.toLowerCase()).not.toMatch(/\broi\b/)
    expect(en.toLowerCase()).not.toMatch(/conversion rate/)
    const attribution = read('components/crm/lead-funnel-attribution.tsx')
    expect(attribution).not.toMatch(/ROI/i)
    expect(attribution).toContain('analyticsEventLinkedLeads')
    expect(attribution).not.toContain('revenue')
  })

  it('preserves Business Command Center and CRM overview wiring (no duplicate top-level module)', () => {
    const nav = read('lib/portal/modules.ts')
    expect(nav).not.toContain('/dashboard/crm/leads/funnel')
    expect(nav).toContain('/dashboard/crm')
    expect(nav).toContain('/dashboard/business')
    expect(read('lib/platform/business-overview/destinations.ts')).toContain("crmLeads: '/dashboard/crm/leads'")
  })
})

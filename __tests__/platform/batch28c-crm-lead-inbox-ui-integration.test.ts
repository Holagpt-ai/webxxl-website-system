import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { crmLeadsEn } from '@/lib/i18n/dictionaries/crm-leads-en'
import { crmLeadsEs } from '@/lib/i18n/dictionaries/crm-leads-es'
import { crmWorkspaceEn } from '@/lib/i18n/dictionaries/crm-workspace-en'
import { crmWorkspaceEs } from '@/lib/i18n/dictionaries/crm-workspace-es'
import { localizePath } from '@/lib/i18n/localize'
import {
  LEADS_API,
  LEAD_LIST_TAKE,
  LEAD_STATUSES,
  LEAD_SUMMARY_KEYS,
  LEAD_TRANSITION_FROM,
  canTransition,
  shouldRefreshSiteLeadCache,
} from '@/lib/crm-ui/leads'
import { withQuery } from '@/lib/crm-ui/workspace'

function read(rel: string) {
  return readFileSync(join(process.cwd(), rel), 'utf8')
}

describe('Batch 28C CRM Lead Inbox UI integration', () => {
  it('registers Website Leads in CRM subnav after Contacts (EN/ES)', () => {
    expect(crmWorkspaceEn.nav.leads).toBe('Website Leads')
    expect(crmWorkspaceEs.nav.leads).toBe('Prospectos del sitio web')
    const layout = read('app/[locale]/dashboard/crm/layout.tsx')
    expect(layout).toContain('`${base}/contacts`')
    expect(layout).toContain('`${base}/leads`')
    expect(layout).toContain('n.leads')
    expect(layout.indexOf('/contacts')).toBeLessThan(layout.indexOf('/leads'))
  })

  it('localizes lead inbox routes and loads account-scoped page props', () => {
    expect(localizePath('en', '/dashboard/crm/leads')).toBe('/dashboard/crm/leads')
    expect(localizePath('es', '/dashboard/crm/leads')).toBe('/es/dashboard/crm/leads')
    const page = read('app/[locale]/dashboard/crm/leads/page.tsx')
    expect(page).toContain('getCrmLeadsPageProps')
    const server = read('lib/crm-ui/server.ts')
    expect(server).toContain('requireCustomerMembership')
    expect(server).toContain('listManagedSitesForAccount')
  })

  it('uses Batch 28A site-leads APIs with account-isolated SWR keys', () => {
    expect(LEADS_API.list).toBe('/api/v1/site-leads')
    expect(LEADS_API.summary).toBe('/api/v1/site-leads/summary')
    const inbox = read('components/crm/lead-inbox.tsx')
    expect(inbox).toContain('useWorkspace')
    expect(inbox).toContain('accountId')
    expect(read('lib/crm-ui/use-workspace.ts')).toContain('[url, accountId]')
  })

  it('supports site, status, date filters and composite cursor pagination', () => {
    const listUrl = withQuery(LEADS_API.list, {
      managedSiteId: 'site_1',
      status: 'QUALIFIED',
      createdFrom: '2026-10-01T00:00:00.000Z',
      createdTo: '2026-10-31T23:59:59.999Z',
      cursor: 'abc',
      take: LEAD_LIST_TAKE,
    })
    expect(listUrl).toContain('managedSiteId=site_1')
    expect(listUrl).toContain('status=QUALIFIED')
    expect(listUrl).toContain('cursor=abc')
    expect(LEAD_STATUSES).toHaveLength(6)
    const inbox = read('components/crm/lead-inbox.tsx')
    expect(inbox).toContain('nextCursor')
    expect(inbox).toContain('cursors')
  })

  it('renders summary metrics with account_total scope only as totals', () => {
    expect(LEAD_SUMMARY_KEYS.length).toBeGreaterThan(0)
    const summary = read('components/crm/lead-summary.tsx')
    expect(summary).toContain("metric?.scope === 'account_total'")
    expect(summary).toContain('notTotal')
  })

  it('requires confirmation before pending review, qualify, reject, and convert', () => {
    const detail = read('components/crm/lead-detail.tsx')
    expect(detail).toContain('pendingReviewDialog')
    expect(detail).toContain('qualifyDialog')
    expect(detail).toContain('rejectDialog')
    expect(detail).toContain('convertDialog')
    expect(detail).not.toMatch(/onClick=\{\(\) => transition\('qualify'\)\}/)
    expect(detail).not.toMatch(/onClick=\{\(\) => transition\('pendingReview'\)\}/)
  })

  it('refreshes list, summary, and detail caches after mutations', () => {
    const accountId = 'acct_a'
    const leadId = 'lead_1'
    expect(shouldRefreshSiteLeadCache([LEADS_API.summary, accountId], accountId)).toBe(true)
    expect(shouldRefreshSiteLeadCache([withQuery(LEADS_API.list, { take: 25 }), accountId], accountId)).toBe(true)
    expect(shouldRefreshSiteLeadCache([LEADS_API.lead(leadId), accountId], accountId, leadId)).toBe(true)
    expect(shouldRefreshSiteLeadCache([LEADS_API.lead(leadId), 'other'], accountId, leadId)).toBe(false)
    expect(read('components/crm/lead-inbox.tsx')).toContain('shouldRefreshSiteLeadCache')
  })

  it('surfaces backend 409 conflicts and preserves reject reason on failure', () => {
    const detail = read('components/crm/lead-detail.tsx')
    expect(detail).toContain('LeadIssueState')
    expect(detail).toContain('result?.ok')
    expect(detail).toContain('action.error')
    expect(crmLeadsEn.issues.statusConflict.title.length).toBeGreaterThan(0)
  })

  it('sends convert idempotency header and links CRM contact after conversion', () => {
    const detail = read('components/crm/lead-detail.tsx')
    expect(detail).toContain("'x-idempotency-key'")
    expect(detail).toContain('newIdempotencyKey')
    expect(detail).toContain('/contacts/')
    expect(canTransition('convert', 'QUALIFIED')).toBe(true)
    expect(canTransition('convert', 'DUPLICATE_REVIEW')).toBe(false)
    expect(LEAD_TRANSITION_FROM.convert).toEqual(['QUALIFIED', 'PENDING_REVIEW'])
  })

  it('defines disabled, unauthorized, and empty inbox copy (EN/ES)', () => {
    expect(crmLeadsEn.issues.intakeDisabled.title).toBeTruthy()
    expect(crmLeadsEn.issues.unauthorized.title).toBeTruthy()
    expect(crmLeadsEn.list.emptyAll.title).toBeTruthy()
    expect(crmLeadsEs.issues.intakeDisabled.title).toBeTruthy()
    expect(crmLeadsEs.list.emptyAll.title).toBeTruthy()
    expect(read('components/crm/lead-inbox.tsx')).toContain('GATE_ISSUES')
  })
})

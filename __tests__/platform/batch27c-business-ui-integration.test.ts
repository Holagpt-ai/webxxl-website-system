import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getDashboardNavModules } from '@/lib/portal/modules'
import { businessCenterEn } from '@/lib/i18n/dictionaries/business-center-en'
import { businessCenterEs } from '@/lib/i18n/dictionaries/business-center-es'
import { localizePath } from '@/lib/i18n/localize'
import {
  BUSINESS_API,
  HEADLINE_METRICS,
  safeDestination,
  snapshotFor,
  totalMetric,
  type BusinessModule,
  type ModuleSnapshot,
} from '@/lib/business-ui/types'

function read(rel: string) {
  return readFileSync(join(process.cwd(), rel), 'utf8')
}

describe('Batch 27C Business Command Center UI integration', () => {
  it('registers Business Center nav after Overview and before Project (EN/ES labels)', () => {
    const nav = getDashboardNavModules()
    const routes = nav.filter((m) => m.route).map((m) => m.route)
    const overviewIdx = routes.indexOf('/dashboard')
    const businessIdx = routes.indexOf('/dashboard/business')
    const projectIdx = routes.indexOf('/dashboard/project')
    expect(overviewIdx).toBeGreaterThanOrEqual(0)
    expect(businessIdx).toBeGreaterThan(overviewIdx)
    expect(projectIdx).toBeGreaterThan(businessIdx)
    expect(nav.filter((m) => m.route === '/dashboard/business')).toHaveLength(1)

    const en = read('lib/i18n/dictionaries/en.ts')
    const es = read('lib/i18n/dictionaries/es.ts')
    expect(en).toContain("businessCenter: 'Business Center'")
    expect(es).toContain("businessCenter: 'Centro de negocios'")
  })

  it('keeps /dashboard as project overview and localizes business routes', () => {
    expect(localizePath('en', '/dashboard')).toBe('/dashboard')
    expect(localizePath('en', '/dashboard/business')).toBe('/dashboard/business')
    expect(localizePath('es', '/dashboard/business')).toBe('/es/dashboard/business')
    const page = read('app/[locale]/dashboard/business/page.tsx')
    expect(page).toContain('getBusinessPageProps')
    expect(read('lib/business-ui/server.ts')).toContain('requireCustomerMembership')
    const layout = read('app/[locale]/dashboard/layout.tsx')
    expect(layout.length).toBeGreaterThan(0)
  })

  it('uses GET /api/v1/business/overview with session account query', () => {
    expect(BUSINESS_API.overview).toBe('/api/v1/business/overview')
    const center = read('components/business/command-center.tsx')
    expect(center).toContain('BUSINESS_API.overview')
    expect(center).toContain('customerAccountId: accountId')
    const route = read('app/api/v1/business/overview/route.ts')
    expect(route).toContain('requireCustomerMembership')
    expect(route).toContain('requestedAccountId !== portal.customerAccount.id')
  })

  it('shows only account_total metrics as headline totals', () => {
    const summary: ModuleSnapshot['summary'] = {
      openTasks: { value: 12, scope: 'account_total' },
      openTasksSample: { value: 6, scope: 'bounded_sample' },
    }
    expect(totalMetric(summary, 'openTasks')).toBe(12)
    expect(totalMetric(summary, 'openTasksSample')).toBeNull()
    for (const module of Object.keys(HEADLINE_METRICS) as BusinessModule[]) {
      for (const key of HEADLINE_METRICS[module]) {
        expect(key).not.toMatch(/Sample$/)
      }
    }
    const card = read('components/business/module-card.tsx')
    expect(card).toContain('totalMetric')
    expect(card).toContain("readiness.state === 'available'")
  })

  it('does not show misleading zero counts for disabled or unavailable modules', () => {
    const disabled: ModuleSnapshot = {
      module: 'crm',
      readiness: { state: 'disabled', reasonCode: 'CRM_DISABLED', message: '' },
    }
    const unavailable: ModuleSnapshot = {
      module: 'marketing',
      readiness: { state: 'unavailable', reasonCode: 'SOURCE_UNAVAILABLE', message: '' },
    }
    expect(totalMetric(disabled.summary, 'openTasks')).toBeNull()
    expect(totalMetric(unavailable.summary, 'draftRequests')).toBeNull()
    const card = read('components/business/module-card.tsx')
    expect(card).toContain('NotAvailableBody')
    expect(card).not.toContain('totalMetric(summary, key) ?? 0')
  })

  it('keeps healthy modules when another module is unavailable', () => {
    const modules: ModuleSnapshot[] = [
      { module: 'crm', readiness: { state: 'available', empty: false, sourceCheckedAt: '2026-10-31T00:00:00.000Z', evidenceCount: 1 }, summary: { openTasks: { value: 2, scope: 'account_total' } } },
      { module: 'marketing', readiness: { state: 'unavailable', reasonCode: 'NOT_CONFIGURED', message: '' } },
    ]
    expect(snapshotFor(modules, 'crm').readiness.state).toBe('available')
    expect(snapshotFor(modules, 'marketing').readiness.state).toBe('unavailable')
    const center = read('components/business/command-center.tsx')
    expect(center).toContain('notReporting')
  })

  it('preserves backend action order when filtering by module or priority', () => {
    const list = read('components/business/action-list.tsx')
    expect(list).toContain("Keeps the backend's priority/timestamp order")
    expect(list).toMatch(/visible = actions\.filter/)
    expect(list).not.toMatch(/\.sort\(/)
  })

  it('localizes safe destinations and blocks unsafe links', () => {
    expect(safeDestination('en', '/dashboard/crm/tasks')).toBe('/dashboard/crm/tasks')
    expect(safeDestination('es', '/dashboard/marketing')).toBe('/es/dashboard/marketing')
    expect(safeDestination('en', 'https://evil.example/phish')).toBeNull()
    expect(safeDestination('en', '/dashboard/../admin')).toBeNull()
    expect(safeDestination('en', '//cdn.example/x')).toBeNull()
  })

  it('remounts the command center when CustomerAccount changes', () => {
    const center = read('components/business/command-center.tsx')
    expect(center).toContain('key={props.accountId}')
    expect(center).toContain('data.overview.customerAccountId === accountId')
    expect(center).toContain('staleAccount')
  })

  it('renders loading, empty, and API error states', () => {
    const center = read('components/business/command-center.tsx')
    expect(center).toContain('LoadingRows')
    expect(center).toContain('WorkspaceState')
    const list = read('components/business/action-list.tsx')
    expect(list).toContain('EmptyNote')
    expect(businessCenterEn.kit).toBeTruthy()
    expect(businessCenterEs.kit).toBeTruthy()
  })
})

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PortalUser } from '@/lib/portal/authz'
import { pickActiveManagedSite } from '@/lib/portal/active-managed-site'
import { pickActiveProject } from '@/lib/portal/active-project'
import { CUSTOMER_DASHBOARD_MODULES } from '@/lib/platform/customer-dashboard/types'
import { buildModuleHandoff } from '@/lib/platform/customer-dashboard/module-handoffs'
import { emptySubscriberEvidence } from '@/lib/platform/open001/subscriber-evidence'

const portal: PortalUser = {
  id: 'user_1',
  role: 'CUSTOMER',
  membership: { role: 'OWNER', customerAccountId: 'acct_a', userId: 'user_1' } as PortalUser['membership'],
  customerAccount: { id: 'acct_a', businessName: 'A Co' } as PortalUser['customerAccount'],
} as PortalUser

vi.mock('@/lib/portal/authz', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/portal/authz')>()
  return {
    ...actual,
    getActiveProject: vi.fn(async () => null),
    getActiveManagedSite: vi.fn(async () => null),
  }
})


vi.mock('@/lib/platform/business-overview/access', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/platform/business-overview/access')>()
  return {
    ...actual,
    loadModuleAccessContext: vi.fn(async (p: PortalUser) => ({
      portal: p,
      evidence: emptySubscriberEvidence(p.customerAccount.id),
      isStaff: false,
    })),
    resolveCrmModuleAccess: () => 'proceed' as const,
    resolveMarketingModuleAccess: () => 'proceed' as const,
    resolveSeoModuleAccess: () => 'proceed' as const,
    resolveCommsModuleAccess: () => 'proceed' as const,
  }
})

import { getCustomerDashboardContext } from '@/lib/platform/customer-dashboard/context-service'

describe('Batch 10B customer dashboard integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRM_BACKEND_ENABLED = 'true'
    process.env.MKT_BACKEND_ENABLED = 'true'
    process.env.SEO_BACKEND_ENABLED = 'true'
    process.env.COMMS_BACKEND_ENABLED = 'true'
    process.env.COMMERCE_BACKEND_ENABLED = 'true'
    process.env.CUSTOMER_AI_WORKFORCE_ENABLED = 'true'
  })

  it('falls back when project or managed site cookies belong to another account', () => {
    const projects = [
      { id: 'p_a', name: 'Site A', status: 'ACTIVE', updatedAt: new Date('2026-01-02T00:00:00.000Z') },
    ]
    const pickedProject = pickActiveProject(projects, 'p_other')
    expect(pickedProject.project?.id).toBe('p_a')
    expect(pickedProject.shouldRefreshCookie).toBe(true)

    const sites = [
      {
        id: 'site_a',
        name: 'Primary',
        projectId: 'p_a',
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      },
    ]
    const pickedSite = pickActiveManagedSite(sites, 'site_other', 'p_a')
    expect(pickedSite.site?.id).toBe('site_a')
    expect(pickedSite.shouldRefreshCookie).toBe(true)
  })

  it('prefers a managed site linked to the active project', () => {
    const sites = [
      {
        id: 'site_old',
        name: 'Older',
        projectId: null,
        updatedAt: new Date('2026-02-01T00:00:00.000Z'),
      },
      {
        id: 'site_linked',
        name: 'Linked',
        projectId: 'p_active',
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]
    const picked = pickActiveManagedSite(sites, null, 'p_active')
    expect(picked.site?.id).toBe('site_linked')
  })

  it('scopes SEO and analytics handoffs to the active managed site', () => {
    const seo = buildModuleHandoff(
      'local_seo',
      { state: 'available', empty: false, sourceCheckedAt: '2026-01-01T00:00:00.000Z', evidenceCount: 0 },
      { managedSiteId: 'site_x' },
    )
    expect(seo.workspace.path).toBe('/dashboard/seo/opportunities?site=site_x')
    const analytics = buildModuleHandoff(
      'analytics',
      { state: 'available', empty: false, sourceCheckedAt: '2026-01-01T00:00:00.000Z', evidenceCount: 0 },
      { managedSiteId: 'site_x' },
    )
    expect(analytics.workspace.path).toContain('site=site_x')
  })

  it('composes dashboard context for every module handoff', async () => {
    const context = await getCustomerDashboardContext(portal)
    expect(context.customerAccountId).toBe('acct_a')
    expect(context.accountScope).toBe('session_membership')
    expect(context.modules.map((m) => m.module)).toEqual([...CUSTOMER_DASHBOARD_MODULES])
    expect(context.crossModule.businessOverview).toBe('/api/v1/business/overview')
  })

  it('exposes GET /api/v1/portal/dashboard-context with tenant scope checks', () => {
    expect(readFileSync(join(process.cwd(), 'lib/dashboard-ui/types.ts'), 'utf8')).toContain(
      '/api/v1/portal/dashboard-context',
    )
    const route = readFileSync(join(process.cwd(), 'app/api/v1/portal/dashboard-context/route.ts'), 'utf8')
    expect(route).toContain('requireCustomerMembership')
    expect(route).toContain('requestedAccountId !== portal.customerAccount.id')
  })

  it('clears selection cookies when switching customer accounts', () => {
    const actions = readFileSync(join(process.cwd(), 'lib/portal/customer-actions.ts'), 'utf8')
    expect(actions).toContain('clearActiveProjectCookie')
    expect(actions).toContain('clearActiveManagedSiteCookie')
    expect(actions).toContain('revalidateCustomerDashboardLayouts')
  })
})
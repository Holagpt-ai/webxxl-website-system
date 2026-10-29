import { describe, expect, it, vi } from 'vitest'
import { canAccessProject } from '@/lib/portal/access-rules'
import { denyBillingGroupSiblingCommsAccess } from '@/lib/platform/comms/account-isolation'
import { assertAbmedChatwootIsolation } from '@/lib/platform/comms/test-fixtures-abmed-comms'
import { evaluateEntitlementAccess, getServiceEntitlement } from '@/lib/platform/entitlements'
import { localizePath } from '@/lib/i18n/localize'
import { getDashboardNavModules } from '@/lib/portal/modules'
import {
  PILOT_ACCOUNT_A_ID,
  PILOT_ACCOUNT_B_ID,
  PILOT_UNRELATED_ACCOUNT_ID,
} from '@/lib/platform/pilot/synthetic-pilot-accounts'
import { allPilotMigrationFolders, PILOT_MODULE_MIGRATIONS } from '@/lib/platform/pilot/migration-prerequisites'
import {
  assessMigrationProbe,
  buildPilotReadinessReport,
} from '@/lib/platform/pilot/readiness-assess'
import { ABMED_AESTHETICS_ACCOUNT_ID, ABMED_PHYSICIANS_ACCOUNT_ID } from '@/lib/platform/fixtures/abmed'

describe('Batch 21A controlled pilot readiness', () => {
  it('defines migration prerequisites for pilot modules', () => {
    expect(PILOT_MODULE_MIGRATIONS.crm).toHaveLength(2)
    expect(allPilotMigrationFolders()).toContain('20261018230000_seo07_foundation')
  })

  it('never marks overall controlled pilot ready without owner activation', () => {
    const report = buildPilotReadinessReport({
      repositorySha: '16861d9c796dd5b808c4186bc4611e10f0a434a2',
      migrationProbe: { state: 'BLOCKED', reason: 'test' },
    })
    expect(report.overallReadyForControlledPilot).toBe(false)
    expect(report.ownerDecisionsRequired.length).toBeGreaterThan(3)
  })

  it('classifies blocked migration probe separately from pass/fail', () => {
    const blocked = assessMigrationProbe({ state: 'BLOCKED', reason: 'no db' })
    expect(blocked.status).toBe('BLOCKED')
    const fail = assessMigrationProbe({
      state: 'FAIL',
      applied: [],
      missing: ['20261018190000_crm05_foundation'],
    })
    expect(fail.status).toBe('FAIL')
  })

  it('reports OPEN-001 POLICY_UNRESOLVED for core pilot entitlements', () => {
    for (const key of ['core.crm', 'core.marketing-studio', 'core.local-seo', 'core.communications'] as const) {
      const ent = getServiceEntitlement(key)!
      expect(evaluateEntitlementAccess(ent).access).toBe('POLICY_UNRESOLVED')
    }
  })

  it('uses two independent synthetic CustomerAccounts', () => {
    expect(PILOT_ACCOUNT_A_ID).toBe(ABMED_AESTHETICS_ACCOUNT_ID)
    expect(PILOT_ACCOUNT_B_ID).toBe(ABMED_PHYSICIANS_ACCOUNT_ID)
    expect(PILOT_ACCOUNT_A_ID).not.toBe(PILOT_ACCOUNT_B_ID)
    expect(PILOT_UNRELATED_ACCOUNT_ID).not.toBe(PILOT_ACCOUNT_A_ID)
  })

  it('denies cross-account project and comms access for synthetic tenants', () => {
    expect(canAccessProject(PILOT_ACCOUNT_A_ID, PILOT_ACCOUNT_B_ID)).toBe(false)
    expect(
      denyBillingGroupSiblingCommsAccess({
        actorUserId: 'u1',
        operatingAccountId: PILOT_ACCOUNT_A_ID,
        recordAccountId: PILOT_ACCOUNT_B_ID,
        operatingMemberships: [{ userId: 'u1', customerAccountId: PILOT_ACCOUNT_A_ID }],
        billingGroupSiblingAccounts: new Map(),
      }).ok,
    ).toBe(false)
    expect(assertAbmedChatwootIsolation().ok).toBe(true)
  })

  it('separates project Messages from business Communications in nav', () => {
    const nav = getDashboardNavModules()
    expect(nav.some((m) => m.route === '/dashboard/messages')).toBe(true)
    expect(nav.some((m) => m.route === '/dashboard/communications')).toBe(true)
  })

  it('localizes pilot dashboard routes for EN and ES', () => {
    expect(localizePath('en', '/dashboard/communications')).toBe('/dashboard/communications')
    expect(localizePath('es', '/dashboard/communications/connections')).toBe(
      '/es/dashboard/communications/connections',
    )
    expect(localizePath('es', '/dashboard/messages')).toBe('/es/dashboard/messages')
  })

  it('marks authenticated pilot smoke as BLOCKED in default report', () => {
    vi.stubEnv('CRM_BACKEND_ENABLED', '0')
    const report = buildPilotReadinessReport({
      repositorySha: 'abc',
      migrationProbe: { state: 'BLOCKED', reason: 'ci' },
    })
    const auth = report.checks.find((c) => c.id === 'test.authenticated_smoke')
    expect(auth?.status).toBe('BLOCKED')
    vi.unstubAllEnvs()
  })
})

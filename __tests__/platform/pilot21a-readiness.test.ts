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
  analyzeMigrationCoverage,
  migrationCompletionState,
  type DbMigrationRow,
} from '@/lib/platform/pilot/migration-probe-analyze'
import { allRepositoryMigrationFolders } from '@/lib/platform/pilot/migration-repository-chain'
import {
  assessMigrationProbe,
  assessMigrationProbeChecks,
  buildPilotReadinessReport,
} from '@/lib/platform/pilot/readiness-assess'
import { ABMED_AESTHETICS_ACCOUNT_ID, ABMED_PHYSICIANS_ACCOUNT_ID } from '@/lib/platform/fixtures/abmed'

function row(
  migration_name: string,
  finished_at: Date | null,
  rolled_back_at: Date | null,
): DbMigrationRow {
  return { migration_name, finished_at, rolled_back_at }
}

describe('Batch 21A controlled pilot readiness', () => {
  it('defines migration prerequisites for pilot modules', () => {
    expect(PILOT_MODULE_MIGRATIONS.crm).toHaveLength(2)
    expect(allPilotMigrationFolders()).toContain('20261018230000_seo07_foundation')
  })

  it('lists full repository migration chain from prisma/migrations directories', () => {
    const chain = allRepositoryMigrationFolders()
    expect(chain.length).toBeGreaterThan(allPilotMigrationFolders().length)
    expect(chain).toContain('20251008120000_customer_portal_core')
    expect(chain).toContain('20261017220000_found01_platform_identity')
    expect(new Set(chain).size).toBe(chain.length)
  })

  it('never marks overall controlled pilot ready without owner activation', () => {
    const report = buildPilotReadinessReport({
      repositorySha: '16861d9c796dd5b808c4186bc4611e10f0a434a2',
      migrationProbe: { state: 'BLOCKED', reason: 'test' },
    })
    expect(report.overallReadyForControlledPilot).toBe(false)
    expect(report.ownerDecisionsRequired.length).toBeGreaterThan(3)
  })

  it('classifies completed migration only when finished_at is set and not rolled back', () => {
    expect(
      migrationCompletionState('20261018190000_crm05_foundation', [
        row('20261018190000_crm05_foundation', new Date(), null),
      ]),
    ).toBe('COMPLETED')
  })

  it('classifies started but unfinished migration as incomplete (not applied)', () => {
    expect(
      migrationCompletionState('20261018190000_crm05_foundation', [
        row('20261018190000_crm05_foundation', null, null),
      ]),
    ).toBe('INCOMPLETE')
  })

  it('classifies rolled-back migration when no successful completion exists', () => {
    expect(
      migrationCompletionState('20261018190000_crm05_foundation', [
        row('20261018190000_crm05_foundation', null, new Date()),
      ]),
    ).toBe('ROLLED_BACK')
  })

  it('classifies missing foundational migration', () => {
    const foundational = '20251008120000_customer_portal_core'
    const pilotOnly = allPilotMigrationFolders()
    const rows = pilotOnly.map((name) => row(name, new Date(), null))
    const full = analyzeMigrationCoverage(allRepositoryMigrationFolders(), rows)
    expect(full.status).toBe('FAIL')
    expect(full.missing).toContain(foundational)
  })

  it('passes pilot modules but fails full chain when only module migrations completed', () => {
    const pilotExpected = allPilotMigrationFolders()
    const rows = pilotExpected.map((name) => row(name, new Date(), null))
    const pilot = analyzeMigrationCoverage(pilotExpected, rows)
    const full = analyzeMigrationCoverage(allRepositoryMigrationFolders(), rows)
    expect(pilot.status).toBe('PASS')
    expect(full.status).toBe('FAIL')
    expect(full.missing.length).toBeGreaterThan(0)

    const checks = assessMigrationProbeChecks({
      state: 'PROBED',
      pilotModules: pilot,
      fullSchemaChain: full,
      disclaimer: 'test',
    })
    expect(checks.find((c) => c.id === 'migrations.pilot_modules')?.status).toBe('PASS')
    expect(checks.find((c) => c.id === 'migrations.full_schema_chain')?.status).toBe('FAIL')
  })

  it('classifies blocked migration probe separately from pass/fail', () => {
    const blocked = assessMigrationProbe({ state: 'BLOCKED', reason: 'no db' })
    expect(blocked.status).toBe('BLOCKED')
    const checks = assessMigrationProbeChecks({
      state: 'PROBED',
      pilotModules: analyzeMigrationCoverage(['20261018190000_crm05_foundation'], []),
      fullSchemaChain: analyzeMigrationCoverage(['20251008120000_customer_portal_core'], []),
      disclaimer: 'test',
    })
    expect(checks.find((c) => c.id === 'migrations.pilot_modules')?.status).toBe('FAIL')
  })

  it('marks both migration checks UNVERIFIED when database probe fails', () => {
    const checks = assessMigrationProbeChecks({
      state: 'UNVERIFIED',
      reason: 'connection refused',
      error: 'ECONNREFUSED',
    })
    expect(checks.every((c) => c.status === 'UNVERIFIED')).toBe(true)
  })

  it('defaults to blocked migration checks without DB probe', () => {
    const report = buildPilotReadinessReport({
      repositorySha: '730a2b84ae8694b8b9431c202f80bd8228c685d6',
      migrationProbe: {
        state: 'BLOCKED',
        reason: 'Set PILOT_READINESS_DB_PROBE=1',
      },
    })
    const mod = report.checks.find((c) => c.id === 'migrations.pilot_modules')
    const full = report.checks.find((c) => c.id === 'migrations.full_schema_chain')
    expect(mod?.status).toBe('BLOCKED')
    expect(full?.status).toBe('BLOCKED')
  })

  it('reports OPEN-001 resolved at policy source for core pilot entitlements', () => {
    for (const key of ['core.crm', 'core.marketing-studio', 'core.local-seo', 'core.communications'] as const) {
      const ent = getServiceEntitlement(key)!
      expect(evaluateEntitlementAccess(ent).access).toBe('INCLUDED')
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

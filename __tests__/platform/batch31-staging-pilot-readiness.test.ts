import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { canAccessProject } from '@/lib/portal/access-rules'
import { ABMED_GROUP_ID, ABMED_AESTHETICS_ACCOUNT_ID, ABMED_PHYSICIANS_ACCOUNT_ID } from '@/lib/platform/fixtures/abmed'
import { buildFeatureReadinessMatrix } from '@/lib/platform/pilot/feature-readiness-matrix'
import {
  buildMigrationDependencyPlan,
  migrationPlanForModules,
} from '@/lib/platform/pilot/migration-dependency-matrix'
import {
  batch31FoundationMigrationFolders,
  PILOT_MODULE_MIGRATIONS,
} from '@/lib/platform/pilot/migration-prerequisites'
import { assessStagingEnvironment } from '@/lib/platform/pilot/staging-environment-assess'
import {
  SYNTHETIC_CUSTOMER_PILOT_STEPS,
  SYNTHETIC_PILOT_SCENARIO,
} from '@/lib/platform/pilot/synthetic-customer-pilot-workflow'
import { buildPilotReadinessReport } from '@/lib/platform/pilot/readiness-assess'
import { localizePath } from '@/lib/i18n/localize'

describe('Batch 31 controlled staging and synthetic pilot readiness', () => {
  it('reports staging environment NOT_IDENTIFIED without staging env vars', () => {
    const assessment = assessStagingEnvironment({ NODE_ENV: 'test' })
    expect(assessment.state).toBe('NOT_IDENTIFIED')
    expect(assessment.isolatedDatabaseConfigured).toBe(false)
    expect(assessment.reproducibleArtifacts.length).toBeGreaterThan(2)
  })

  it('orders migration plan and includes Batch 28A site leads after CRM foundation', () => {
    const plan = buildMigrationDependencyPlan()
    expect(plan.length).toBeGreaterThan(30)
    const crmIdx = plan.findIndex((e) => e.folder === '20261018190000_crm05_foundation')
    const leadsIdx = plan.findIndex((e) => e.folder === '20261031120000_batch28a_managed_site_leads')
    expect(crmIdx).toBeGreaterThan(-1)
    expect(leadsIdx).toBeGreaterThan(crmIdx)
    const slice = migrationPlanForModules(['site_leads'])
    expect(slice.map((s) => s.folder)).toEqual([...PILOT_MODULE_MIGRATIONS.siteLeads])
  })

  it('lists Batch 31 foundation migrations including OPEN-001 platform and site leads', () => {
    const folders = batch31FoundationMigrationFolders()
    expect(folders).toContain('20261017220000_found01_platform_identity')
    expect(folders).toContain('20261031140000_batch28a_2_intake_payload_fingerprint')
  })

  it('defines feature readiness matrix with distinct module states', () => {
    const matrix = buildFeatureReadinessMatrix()
    expect(matrix.find((r) => r.id === 'crm')?.typicalCustomerState).toBe('disabled')
    expect(matrix.find((r) => r.id === 'site_lead_intake')?.flagEnabled).toBe(false)
    expect(matrix.find((r) => r.id === 'business_command_center')?.typicalCustomerState).toBe('ready_pending_data')
  })

  it('models synthetic pilot: shared BillingGroup, two accounts, eight workflow steps', () => {
    expect(SYNTHETIC_PILOT_SCENARIO.billingGroupId).toBe(ABMED_GROUP_ID)
    expect(SYNTHETIC_PILOT_SCENARIO.accountAId).toBe(ABMED_AESTHETICS_ACCOUNT_ID)
    expect(SYNTHETIC_PILOT_SCENARIO.accountBId).toBe(ABMED_PHYSICIANS_ACCOUNT_ID)
    expect(SYNTHETIC_CUSTOMER_PILOT_STEPS.length).toBe(8)
    expect(SYNTHETIC_CUSTOMER_PILOT_STEPS.map((s) => s.coverage)).toContain('funnel')
    expect(SYNTHETIC_CUSTOMER_PILOT_STEPS.map((s) => s.coverage)).toContain('isolation')
  })

  it('denies cross-account project access for synthetic pilot tenants', () => {
    expect(canAccessProject(SYNTHETIC_PILOT_SCENARIO.accountAId, SYNTHETIC_PILOT_SCENARIO.accountBId)).toBe(false)
  })

  it('registers portal review/approvals routes for project workflow pilot step', () => {
    expect(localizePath('es', '/dashboard/review')).toBe('/es/dashboard/review')
    expect(localizePath('en', '/dashboard/approvals')).toBe('/dashboard/approvals')
    const routeMap = readFileSync(join(process.cwd(), 'docs/ROUTE_MAP.md'), 'utf8')
    expect(routeMap).toContain('/dashboard/review')
  })

  it('includes site lead intake flag in pilot readiness report', () => {
    const report = buildPilotReadinessReport({
      repositorySha: '3a7d011466aeabcf4c2d3bdfe8a669d42e448957',
      migrationProbe: { state: 'BLOCKED', reason: 'ci' },
    })
    expect(report.checks.some((c) => c.id === 'flag.site_lead_intake')).toBe(true)
    expect(report.overallReadyForControlledPilot).toBe(false)
    expect(report.ownerDecisionsRequired.some((o) => o.includes('Batch 31'))).toBe(true)
  })

  it('documents migration rehearsal and synthetic pilot scripts', () => {
    const pkg = readFileSync(join(process.cwd(), 'package.json'), 'utf8')
    expect(pkg).toContain('migration:rehearsal')
    expect(pkg).toContain('synthetic-pilot:report')
  })
})

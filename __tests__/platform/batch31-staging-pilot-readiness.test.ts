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
import {
  databaseIdentityFromUrl,
  verifyStagingDatabaseConnectionPair,
  verifyStagingDatabaseConnections,
} from '@/lib/platform/pilot/staging-database-preflight'
import { allRepositoryMigrationFolders } from '@/lib/platform/pilot/migration-repository-chain'

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

describe('Batch 31.1 staging safety guard', () => {
  const stagingUrl = 'postgresql://user:secret@db.staging.example.com:5432/webxxl_staging?schema=public'
  const identity = 'db.staging.example.com:5432/webxxl_staging'

  it('states prisma migrate deploy applies the full pending chain in the rehearsal runbook', () => {
    const script = readFileSync(join(process.cwd(), 'scripts/migration-rehearsal.ts'), 'utf8')
    expect(script).toContain('FULL pending migration chain')
    expect(script).toContain('--foundation')
    expect(script).toContain('READ-ONLY report')
    const chain = allRepositoryMigrationFolders()
    expect(script).toMatch(/ALL pending migrations/)
    expect(chain.length).toBeGreaterThan(batch31FoundationMigrationFolders().length)
  })

  it('rejects mismatched DATABASE_URL and DIRECT_URL targets', () => {
    const result = verifyStagingDatabaseConnectionPair({
      DATABASE_URL: stagingUrl,
      DIRECT_URL: 'postgresql://user:secret@other.host:5432/webxxl_staging',
      WEBXXL_STAGING_DATABASE_IDENTITY: identity,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('MISMATCHED_TARGETS')
  })

  it('rejects missing staging identity evidence', () => {
    const result = verifyStagingDatabaseConnectionPair({
      DATABASE_URL: stagingUrl,
      DIRECT_URL: stagingUrl,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('MISSING_STAGING_IDENTITY')
  })

  it('does not treat env presence alone as BOUNDARIES_VERIFIED', () => {
    const assessment = assessStagingEnvironment({
      NODE_ENV: 'test',
      DATABASE_URL: stagingUrl,
      DIRECT_URL: stagingUrl,
      WEBXXL_STAGING_DATABASE_IDENTITY: identity,
      WEBXXL_STAGING_APP_URL: 'https://staging.example.webxxl.internal',
    })
    expect(assessment.state).not.toBe('BOUNDARIES_VERIFIED')
    expect(assessment.state).toBe('CONFIG_PRESENT_UNVERIFIED')
  })

  it('reports BOUNDARIES_VERIFIED only with identity match and operator confirmation', () => {
    const assessment = assessStagingEnvironment({
      NODE_ENV: 'test',
      DATABASE_URL: stagingUrl,
      DIRECT_URL: stagingUrl,
      WEBXXL_STAGING_DATABASE_IDENTITY: identity,
      WEBXXL_STAGING_BOUNDARIES_CONFIRMED: '1',
      WEBXXL_PRODUCTION_DATABASE_IDENTITY: 'db.prod.example.com:5432/webxxl_prod',
    })
    expect(assessment.state).toBe('BOUNDARIES_VERIFIED')
    expect(verifyStagingDatabaseConnections({
      DATABASE_URL: stagingUrl,
      DIRECT_URL: stagingUrl,
      WEBXXL_STAGING_DATABASE_IDENTITY: identity,
      WEBXXL_STAGING_BOUNDARIES_CONFIRMED: '1',
    }).ok).toBe(true)
  })

  it('parses database identity without exposing credentials', () => {
    expect(databaseIdentityFromUrl(stagingUrl)).toBe(identity)
    expect(databaseIdentityFromUrl(stagingUrl)).not.toContain('secret')
  })
})

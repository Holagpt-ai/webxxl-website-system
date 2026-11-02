import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { canAccessProject } from '@/lib/portal/access-rules'
import { ABMED_AESTHETICS_ACCOUNT_ID, ABMED_PHYSICIANS_ACCOUNT_ID } from '@/lib/platform/fixtures/abmed'
import { buildFeatureReadinessMatrix } from '@/lib/platform/pilot/feature-readiness-matrix'
import { validateMigrationOrderingSafeguards } from '@/lib/platform/pilot/migration-ordering-safeguards'
import { batch38ReleaseMigrationFolders } from '@/lib/platform/pilot/migration-prerequisites'
import { buildReleaseReadinessReport } from '@/lib/platform/pilot/release-readiness-assess'
import { assessReleaseExecutionGuardrails } from '@/lib/platform/pilot/release-execution-guardrails'
import { buildStagingRolloutChecklist } from '@/lib/platform/pilot/staging-rollout-checklist'
import { denyBillingGroupSiblingCustomerAiAccess } from '@/lib/platform/customer-ai-workforce/account-isolation'

describe('Batch 38 release readiness', () => {
  it('validates migration ordering safeguards for full repository chain', () => {
    const result = validateMigrationOrderingSafeguards()
    expect(result.folderCount).toBeGreaterThanOrEqual(35)
    expect(result.ok).toBe(true)
    expect(result.issues.some((i) => i.code === 'MISSING_SQL')).toBe(false)
    const dup = result.issues.filter((i) => i.code === 'DUPLICATE_TIMESTAMP_PREFIX')
    expect(dup.length).toBeGreaterThan(0)
    expect(dup[0]?.folders).toContain('20261031120000_batch28a_managed_site_leads')
  })

  it('includes Batch 37 pilot persistence in release migration slice', () => {
    const slice = batch38ReleaseMigrationFolders()
    expect(slice).toContain('20261102130000_batch37_customer_ai_pilot_persistence')
    expect(slice).toContain('20261020140000_ai_customer_13_foundation')
    expect(slice).toContain('20261018280000_auto10_workflow_foundation')
  })

  it('keeps AI and workflow execution guardrails OFF in test environment', () => {
    const checks = assessReleaseExecutionGuardrails()
    expect(checks.every((c) => c.status === 'PASS')).toBe(true)
    expect(checks.some((c) => c.id === 'flag.customer_ai_execution')).toBe(true)
    expect(checks.some((c) => c.id === 'flag.workflow_worker')).toBe(true)
  })

  it('builds release readiness report with ordering and tenant inventory checks', () => {
    const report = buildReleaseReadinessReport({
      repositorySha: '8c2e5df7f79eb7538e1fe6d513316f70026bbe6d',
      migrationProbe: { state: 'BLOCKED', reason: 'ci' },
    })
    expect(report.batchId).toBe('38')
    expect(report.migrationOrderingOk).toBe(true)
    expect(report.checks.some((c) => c.id === 'tenant.isolation_modules' && c.status === 'PASS')).toBe(true)
    expect(report.checks.some((c) => c.id === 'approvals.pilot_binding' && c.status === 'PASS')).toBe(true)
    expect(report.overallReadyForControlledPilot).toBe(false)
    expect(report.stagingRolloutMarkdown).toContain('Customer AI pilot prep')
  })

  it('staging rollout checklist distinguishes lifecycle columns', () => {
    const checklist = buildStagingRolloutChecklist({ repositoryMainSha: '8c2e5df' })
    expect(checklist.rows.length).toBeGreaterThan(4)
    expect(checklist.rows.every((r) => r.merged === 'MERGED')).toBe(true)
    expect(checklist.rows.every((r) => r.deployed === 'UNVERIFIED')).toBe(true)
    expect(checklist.operationalSequence.some((s) => s.includes('migrate deploy'))).toBe(true)
  })

  it('denies billing-group sibling access for customer AI pilot context', () => {
    const denied = denyBillingGroupSiblingCustomerAiAccess({
      actorUserId: 'billing_owner',
      operatingAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      recordAccountId: ABMED_PHYSICIANS_ACCOUNT_ID,
      operatingMemberships: [{ userId: 'billing_owner', customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID }],
      billingGroupSiblingAccounts: new Map([['bg1', [ABMED_AESTHETICS_ACCOUNT_ID, ABMED_PHYSICIANS_ACCOUNT_ID]]]),
    })
    expect(denied.ok).toBe(false)
    expect(canAccessProject(ABMED_AESTHETICS_ACCOUNT_ID, ABMED_PHYSICIANS_ACCOUNT_ID)).toBe(false)
  })

  it('feature matrix includes customer AI and workflow worker rows default disabled', () => {
    const matrix = buildFeatureReadinessMatrix()
    expect(matrix.find((r) => r.id === 'customer_ai_pilot')?.typicalCustomerState).toBe('disabled')
    expect(matrix.find((r) => r.id === 'auto10_workflow_worker')?.typicalCustomerState).toBe('disabled')
  })

  it('registers release:readiness script in package.json', () => {
    const pkg = readFileSync(join(process.cwd(), 'package.json'), 'utf8')
    expect(pkg).toContain('release:readiness')
    const script = readFileSync(join(process.cwd(), 'scripts/release-readiness.ts'), 'utf8')
    expect(script).toContain('--verify-ordering')
    expect(script).toContain('buildReleaseReadinessReport')
  })
})

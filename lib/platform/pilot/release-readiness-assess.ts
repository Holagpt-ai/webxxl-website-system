import fs from 'node:fs'
import path from 'node:path'
import {
  assessReleaseExecutionGuardrails,
  APPROVAL_BOUNDARY_PATHS,
  TENANT_ISOLATION_MODULE_PATHS,
} from '@/lib/platform/pilot/release-execution-guardrails'
import {
  buildPilotReadinessReport,
  type MigrationProbeResult,
  summarizePilotReport,
} from '@/lib/platform/pilot/readiness-assess'
import { validateMigrationOrderingSafeguards } from '@/lib/platform/pilot/migration-ordering-safeguards'
import { batch38ReleaseMigrationFolders } from '@/lib/platform/pilot/migration-prerequisites'
import { buildStagingRolloutChecklist, formatStagingRolloutMarkdown } from '@/lib/platform/pilot/staging-rollout-checklist'
import type { PilotCheckResult, PilotReadinessReport } from '@/lib/platform/pilot/types'

export type ReleaseReadinessReport = PilotReadinessReport & {
  batchId: '38'
  migrationOrderingOk: boolean
  migrationOrderingIssues: ReturnType<typeof validateMigrationOrderingSafeguards>['issues']
  releaseMigrationSlice: string[]
  stagingRolloutMarkdown: string
}

function fileExists(relativePath: string, cwd = process.cwd()): boolean {
  return fs.existsSync(path.join(cwd, relativePath))
}

function inventoryCheck(
  id: string,
  label: string,
  paths: readonly string[],
  cwd = process.cwd(),
): PilotCheckResult {
  const missing = paths.filter((p) => !fileExists(p, cwd))
  return {
    id,
    label,
    evidenceKind: 'APPLICATION_CODE',
    status: missing.length ? 'FAIL' : 'PASS',
    summary: missing.length ? `Missing ${missing.length} expected path(s)` : 'Expected isolation/approval modules present in repository',
    detail: missing.length ? missing.join(', ') : paths.join(', '),
  }
}

export function buildReleaseReadinessReport(input: {
  repositorySha: string
  migrationProbe: MigrationProbeResult
  cwd?: string
}): ReleaseReadinessReport {
  const cwd = input.cwd ?? process.cwd()
  const base = buildPilotReadinessReport({
    repositorySha: input.repositorySha,
    migrationProbe: input.migrationProbe,
  })

  const ordering = validateMigrationOrderingSafeguards(cwd)
  const guardrails = assessReleaseExecutionGuardrails()
  const releaseSlice = batch38ReleaseMigrationFolders()

  const extraChecks: PilotCheckResult[] = [
    {
      id: 'migrations.ordering_safeguards',
      label: 'Migration ordering safeguards',
      evidenceKind: 'DATABASE_MIGRATION',
      status: ordering.ok ? 'PASS' : 'FAIL',
      summary: ordering.ok
        ? `${ordering.folderCount} migration folders; lexicographic chain validated`
        : 'Migration repository failed ordering safeguards',
      detail: ordering.issues.map((i) => `${i.code}: ${i.message}`).join('; ') || undefined,
    },
    {
      id: 'migrations.batch38_release_slice',
      label: 'Batch 38 release migration slice (inventory)',
      evidenceKind: 'DATABASE_MIGRATION',
      status: releaseSlice.every((f) => ordering.orderedFolders.includes(f)) ? 'PASS' : 'FAIL',
      summary: `${releaseSlice.length} folders in Batch 38 staging release slice`,
      detail: releaseSlice.join(', '),
    },
    inventoryCheck('tenant.isolation_modules', 'CustomerAccount / BillingGroup isolation modules', TENANT_ISOLATION_MODULE_PATHS, cwd),
    inventoryCheck('approvals.pilot_binding', 'Pilot human approval binding surfaces', APPROVAL_BOUNDARY_PATHS, cwd),
    ...guardrails,
  ]

  const ownerDecisionsRequired = [
    ...base.ownerDecisionsRequired,
    'Batch 38: reconcile Vercel production SHA for `main` @ latest merge — deployment evidence UNVERIFIED until owner/Vercel record.',
    'Batch 38: apply full pending migration chain on isolated staging only; production migrate deploy is a separate owner authorization.',
    'Batch 38: resolve DUPLICATE_TIMESTAMP_PREFIX pairs in rehearsal output before assuming deterministic ordering between colliding folders.',
    'Batch 38: keep CUSTOMER_AI_* execution and WORKFLOW_WORKER_ENABLED OFF until staging acceptance signoff.',
  ]

  const rollout = buildStagingRolloutChecklist({ repositoryMainSha: input.repositorySha })

  return {
    ...base,
    batchId: '38',
    checks: [...base.checks, ...extraChecks],
    ownerDecisionsRequired,
    migrationOrderingOk: ordering.ok,
    migrationOrderingIssues: ordering.issues,
    releaseMigrationSlice: releaseSlice,
    stagingRolloutMarkdown: formatStagingRolloutMarkdown(rollout),
  }
}

export function summarizeReleaseReadinessReport(report: ReleaseReadinessReport): string {
  const lines = [
    summarizePilotReport(report),
    '',
    `Migration ordering OK: ${report.migrationOrderingOk}`,
    report.migrationOrderingIssues.length
      ? `Ordering notes: ${report.migrationOrderingIssues.map((i) => i.code).join(', ')}`
      : '',
    '',
    report.stagingRolloutMarkdown,
  ].filter(Boolean)
  return lines.join('\n')
}

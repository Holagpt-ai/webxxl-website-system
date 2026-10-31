#!/usr/bin/env tsx
/**
 * Read-only migration rehearsal planner. Does NOT run `migrate deploy` against any environment.
 *
 * Usage:
 *   pnpm exec tsx scripts/migration-rehearsal.ts
 *   pnpm exec tsx scripts/migration-rehearsal.ts --foundation
 *   pnpm exec tsx scripts/migration-rehearsal.ts --check-files
 *   pnpm exec tsx scripts/migration-rehearsal.ts --verify-db
 */
import { execSync } from 'node:child_process'
import {
  buildMigrationDependencyPlan,
  formatMigrationPlanMarkdown,
  migrationPlanForModules,
} from '@/lib/platform/pilot/migration-dependency-matrix'
import { batch31FoundationMigrationFolders } from '@/lib/platform/pilot/migration-prerequisites'
import { allRepositoryMigrationFolders } from '@/lib/platform/pilot/migration-repository-chain'
import { verifyStagingDatabaseConnections } from '@/lib/platform/pilot/staging-database-preflight'

const PREFLIGHT = [
  '1. Confirm target is isolated STAGING database (not production).',
  '2. Take snapshot / backup of staging before apply.',
  '3. Set DATABASE_URL and DIRECT_URL to the same authorized staging target (see WEBXXL_STAGING_DATABASE_IDENTITY).',
  '4. Run: pnpm exec prisma migrate deploy — applies the FULL pending migration chain only (no selective slice flag in Prisma).',
  '5. The --foundation CLI flag below filters this READ-ONLY report; it does NOT change what migrate deploy applies.',
  '6. Run: PILOT_READINESS_DB_PROBE=1 pnpm pilot:readiness (after DATABASE_URL + DIRECT_URL + identity preflight pass).',
  '7. Record `_prisma_migrations` rows and compare to the full-chain plan.',
  '8. On failure: restore snapshot; do not partial-drop tables on shared instances.',
]

function resolveSha(): string {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim()
  } catch {
    return 'unknown'
  }
}

function main() {
  const foundationOnly = process.argv.includes('--foundation')
  const checkFiles = process.argv.includes('--check-files')
  const verifyDb = process.argv.includes('--verify-db')

  if (verifyDb) {
    const result = verifyStagingDatabaseConnections(process.env)
    if (!result.ok) {
      process.stderr.write(`Staging DB preflight failed [${result.code}]: ${result.message}\n`)
      process.exitCode = 1
      return
    }
    process.stdout.write(`Staging DB preflight passed for identity ${result.identity}\n`)
    return
  }

  const chain = allRepositoryMigrationFolders()
  const fullPlan = buildMigrationDependencyPlan()
  const plan = foundationOnly
    ? fullPlan.filter((e) => batch31FoundationMigrationFolders().includes(e.folder))
    : fullPlan

  process.stdout.write(`WebXXL migration rehearsal plan @ ${resolveSha().slice(0, 7)}\n`)
  process.stdout.write(
    `Report mode: ${foundationOnly ? 'Batch 31 foundation subset (display filter only)' : 'full repository chain'}\n`,
  )
  process.stdout.write(`Rows shown: ${plan.length} of ${chain.length} total migration folders\n`)
  process.stdout.write(`Prisma migrate deploy: always applies ALL pending migrations (${chain.length} folders in source)\n\n`)

  process.stdout.write('## Preflight (owner-authorized staging only)\n')
  for (const line of PREFLIGHT) process.stdout.write(`${line}\n`)
  process.stdout.write('\n')

  process.stdout.write('## Dependency matrix (this report)\n')
  process.stdout.write(`${formatMigrationPlanMarkdown(plan)}\n\n`)

  if (foundationOnly) {
    process.stdout.write(
      '## Note on --foundation\nThis section is a read-only priority view. Operators must still run `prisma migrate deploy` for the entire pending chain.\n\n',
    )
  }

  const destructive = plan.filter((e) => e.risk === 'destructive_hint')
  if (destructive.length) {
    process.stdout.write('## Destructive hints (review SQL before apply)\n')
    for (const e of destructive) process.stdout.write(`- ${e.folder}\n`)
    process.stdout.write('\n')
  }

  if (checkFiles) {
    const missing = chain.filter((f) => !fullPlan.some((p) => p.folder === f))
    if (missing.length) process.stderr.write(`WARN: plan missing chain entries: ${missing.join(', ')}\n`)
  }

  const pilotModules = migrationPlanForModules(['site_leads', 'crm', 'open001_platform'])
  process.stdout.write(`## Batch 31 priority slice (${pilotModules.length} rows, report only)\n`)
  process.stdout.write(`${formatMigrationPlanMarkdown(pilotModules)}\n`)
}

main()

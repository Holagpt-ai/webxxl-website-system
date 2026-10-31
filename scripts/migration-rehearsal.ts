#!/usr/bin/env tsx
/**
 * Read-only migration rehearsal planner. Does NOT run `migrate deploy` against any environment.
 *
 * Usage:
 *   pnpm exec tsx scripts/migration-rehearsal.ts
 *   pnpm exec tsx scripts/migration-rehearsal.ts --foundation
 *   pnpm exec tsx scripts/migration-rehearsal.ts --check-files
 */
import { execSync } from 'node:child_process'
import {
  buildMigrationDependencyPlan,
  formatMigrationPlanMarkdown,
  migrationPlanForModules,
} from '@/lib/platform/pilot/migration-dependency-matrix'
import { batch31FoundationMigrationFolders } from '@/lib/platform/pilot/migration-prerequisites'
import { allRepositoryMigrationFolders } from '@/lib/platform/pilot/migration-repository-chain'

const PREFLIGHT = [
  '1. Confirm target is isolated STAGING database (not production).',
  '2. Take snapshot / backup of staging before apply.',
  '3. Set DATABASE_URL and DIRECT_URL to staging credentials on operator machine only.',
  '4. Run: pnpm exec prisma migrate deploy',
  '5. Run: PILOT_READINESS_DB_PROBE=1 pnpm pilot:readiness',
  '6. Record `_prisma_migrations` rows and compare to this plan.',
  '7. On failure: restore snapshot; do not partial-drop tables on shared instances.',
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

  const chain = allRepositoryMigrationFolders()
  const plan = foundationOnly
    ? buildMigrationDependencyPlan().filter((e) => batch31FoundationMigrationFolders().includes(e.folder))
    : buildMigrationDependencyPlan()

  process.stdout.write(`WebXXL migration rehearsal plan @ ${resolveSha().slice(0, 7)}\n`)
  process.stdout.write(`Mode: ${foundationOnly ? 'Batch 31 foundation modules' : 'full repository chain'}\n`)
  process.stdout.write(`Folders: ${plan.length} of ${chain.length} total\n\n`)

  process.stdout.write('## Preflight (owner-authorized staging only)\n')
  for (const line of PREFLIGHT) process.stdout.write(`${line}\n`)
  process.stdout.write('\n')

  process.stdout.write('## Dependency matrix\n')
  process.stdout.write(`${formatMigrationPlanMarkdown(plan)}\n\n`)

  const destructive = plan.filter((e) => e.risk === 'destructive_hint')
  if (destructive.length) {
    process.stdout.write('## Destructive hints (review SQL before apply)\n')
    for (const e of destructive) process.stdout.write(`- ${e.folder}\n`)
    process.stdout.write('\n')
  }

  if (checkFiles) {
    const missing = chain.filter((f) => !plan.some((p) => p.folder === f))
    if (missing.length) process.stderr.write(`WARN: plan missing chain entries: ${missing.join(', ')}\n`)
  }

  const pilotModules = migrationPlanForModules(['site_leads', 'crm', 'open001_platform'])
  process.stdout.write(`## Batch 31 priority slice (${pilotModules.length} rows)\n`)
  process.stdout.write(`${formatMigrationPlanMarkdown(pilotModules)}\n`)
}

main()

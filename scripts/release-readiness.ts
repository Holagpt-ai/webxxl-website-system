#!/usr/bin/env tsx
/**
 * Batch 38 — read-only release / staging acceptance report. Does not migrate, deploy, or activate providers.
 *
 * Usage:
 *   pnpm release:readiness
 *   pnpm release:readiness --verify-ordering
 *   PILOT_READINESS_DB_PROBE=1 pnpm release:readiness
 */
import { execSync } from 'node:child_process'
import { PrismaClient } from '@prisma/client'
import { analyzeMigrationCoverage } from '@/lib/platform/pilot/migration-probe-analyze'
import { batch38ReleaseMigrationFolders } from '@/lib/platform/pilot/migration-prerequisites'
import { allRepositoryMigrationFolders } from '@/lib/platform/pilot/migration-repository-chain'
import { validateMigrationOrderingSafeguards } from '@/lib/platform/pilot/migration-ordering-safeguards'
import {
  buildReleaseReadinessReport,
  summarizeReleaseReadinessReport,
  type ReleaseReadinessReport,
} from '@/lib/platform/pilot/release-readiness-assess'
import type { MigrationProbeResult } from '@/lib/platform/pilot/readiness-assess'
import { verifyStagingDatabaseConnectionPair } from '@/lib/platform/pilot/staging-database-preflight'

function resolveSha(): string {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim()
  } catch {
    return 'unknown'
  }
}

async function probeMigrations(): Promise<MigrationProbeResult> {
  if (process.env.PILOT_READINESS_DB_PROBE !== '1') {
    return {
      state: 'BLOCKED',
      reason: 'Set PILOT_READINESS_DB_PROBE=1 with authorized staging DATABASE_URL to probe migration history (read-only)',
    }
  }
  if (!process.env.DATABASE_URL?.trim()) {
    return { state: 'BLOCKED', reason: 'DATABASE_URL is not set' }
  }
  const preflight = verifyStagingDatabaseConnectionPair(process.env)
  if (!preflight.ok) {
    return {
      state: 'BLOCKED',
      reason: `Staging DB preflight blocked probe (${preflight.code}): ${preflight.message}`,
    }
  }

  const prisma = new PrismaClient()
  try {
    const rows = await prisma.$queryRaw<
      { migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }[]
    >`
      SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations"
    `
    const pilotExpected = batch38ReleaseMigrationFolders()
    const fullExpected = allRepositoryMigrationFolders()
    return {
      state: 'PROBED',
      pilotModules: analyzeMigrationCoverage(pilotExpected, rows),
      fullSchemaChain: analyzeMigrationCoverage(fullExpected, rows),
      disclaimer:
        'Matching migration history does not prove schema integrity, data correctness, or authenticated functionality.',
    }
  } catch (error) {
    return {
      state: 'UNVERIFIED',
      reason: 'Migration probe query failed',
      error: error instanceof Error ? error.message : String(error),
    }
  } finally {
    await prisma.$disconnect()
  }
}

async function main() {
  const verifyOrderingOnly = process.argv.includes('--verify-ordering')
  const ordering = validateMigrationOrderingSafeguards()

  if (verifyOrderingOnly) {
    process.stdout.write(`Migration folders: ${ordering.folderCount}\n`)
    for (const issue of ordering.issues) {
      process.stdout.write(`[${issue.code}] ${issue.message}\n`)
      if (issue.folders?.length) process.stdout.write(`  ${issue.folders.join(', ')}\n`)
    }
    if (!ordering.ok) process.exitCode = 1
    return
  }

  const probe = await probeMigrations()
  const report: ReleaseReadinessReport = buildReleaseReadinessReport({
    repositorySha: resolveSha(),
    migrationProbe: probe,
  })

  process.stdout.write(`${summarizeReleaseReadinessReport(report)}\n`)
  if (!report.migrationOrderingOk) process.exitCode = 1
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})

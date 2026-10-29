#!/usr/bin/env tsx
/**
 * Read-only controlled pilot readiness report. Does not mutate database, flags, or providers.
 * Optional migration probe: PILOT_READINESS_DB_PROBE=1 and DATABASE_URL set (SELECT on _prisma_migrations only).
 */
import { execSync } from 'node:child_process'
import { PrismaClient } from '@prisma/client'
import { analyzeMigrationCoverage } from '@/lib/platform/pilot/migration-probe-analyze'
import { allPilotMigrationFolders } from '@/lib/platform/pilot/migration-prerequisites'
import { allRepositoryMigrationFolders } from '@/lib/platform/pilot/migration-repository-chain'
import {
  buildPilotReadinessReport,
  summarizePilotReport,
  type MigrationProbeResult,
} from '@/lib/platform/pilot/readiness-assess'

const MIGRATION_HISTORY_DISCLAIMER =
  'Matching migration history does not prove schema integrity, data correctness, or authenticated functionality.'

async function probeMigrations(): Promise<MigrationProbeResult> {
  if (process.env.PILOT_READINESS_DB_PROBE !== '1') {
    return {
      state: 'BLOCKED',
      reason: 'Set PILOT_READINESS_DB_PROBE=1 with DATABASE_URL to probe migration history (read-only)',
    }
  }
  if (!process.env.DATABASE_URL?.trim()) {
    return { state: 'BLOCKED', reason: 'DATABASE_URL is not set' }
  }

  const pilotExpected = allPilotMigrationFolders()
  const fullExpected = allRepositoryMigrationFolders()
  const prisma = new PrismaClient()
  try {
    const rows = await prisma.$queryRaw<
      { migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }[]
    >`
      SELECT migration_name, finished_at, rolled_back_at
      FROM "_prisma_migrations"
    `
    const pilotModules = analyzeMigrationCoverage(pilotExpected, rows)
    const fullSchemaChain = analyzeMigrationCoverage(fullExpected, rows)
    return {
      state: 'PROBED',
      pilotModules,
      fullSchemaChain,
      disclaimer: MIGRATION_HISTORY_DISCLAIMER,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      state: 'UNVERIFIED',
      reason: 'Database migration probe failed — apply state unknown',
      error: message,
    }
  } finally {
    await prisma.$disconnect()
  }
}

function resolveSha(): string {
  if (process.env.PILOT_READINESS_SHA?.trim()) return process.env.PILOT_READINESS_SHA.trim()
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim()
  } catch {
    return 'unknown'
  }
}

async function main() {
  const migrationProbe = await probeMigrations()
  const report = buildPilotReadinessReport({
    repositorySha: resolveSha(),
    migrationProbe,
    authenticatedPilotSmoke: 'BLOCKED',
  })

  const json = JSON.stringify(report, null, 2)
  if (process.argv.includes('--json')) {
    process.stdout.write(`${json}\n`)
  } else {
    process.stdout.write(`${summarizePilotReport(report)}\n\n`)
    process.stdout.write(`${json}\n`)
  }

  const hardFail = report.checks.some((c) => c.status === 'FAIL')
  if (hardFail) process.exitCode = 1
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

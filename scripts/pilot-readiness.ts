#!/usr/bin/env tsx
/**
 * Read-only controlled pilot readiness report. Does not mutate database, flags, or providers.
 * Optional migration probe: PILOT_READINESS_DB_PROBE=1 and DATABASE_URL set (SELECT on _prisma_migrations only).
 */
import { execSync } from 'node:child_process'
import { PrismaClient } from '@prisma/client'
import {
  assessMigrationProbe,
  buildPilotReadinessReport,
  summarizePilotReport,
  type MigrationProbeResult,
} from '@/lib/platform/pilot/readiness-assess'
import { allPilotMigrationFolders } from '@/lib/platform/pilot/migration-prerequisites'

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
  const expected = allPilotMigrationFolders()
  const prisma = new PrismaClient()
  try {
    const rows = await prisma.$queryRaw<{ migration_name: string }[]>`
      SELECT migration_name FROM "_prisma_migrations" WHERE rolled_back_at IS NULL
    `
    const applied = new Set(rows.map((r) => r.migration_name))
    const missing = expected.filter((m) => !applied.has(m))
    if (missing.length === 0) return { state: 'PASS', applied: [...applied] }
    return { state: 'FAIL', applied: [...applied], missing }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { state: 'UNVERIFIED', applied: [], missing: expected, error: message }
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

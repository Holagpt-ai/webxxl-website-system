/** Read-only interpretation of `_prisma_migrations` rows — not schema or data integrity proof. */

export type DbMigrationRow = {
  migration_name: string
  finished_at: Date | null
  rolled_back_at: Date | null
}

export type MigrationCompletionState = 'COMPLETED' | 'INCOMPLETE' | 'ROLLED_BACK' | 'MISSING'

export type MigrationCoverageSummary = {
  expected: string[]
  completed: string[]
  missing: string[]
  incomplete: string[]
  rolledBack: string[]
  /** PASS only when every expected migration is COMPLETED (no missing/incomplete/rolled-back). */
  status: 'PASS' | 'FAIL'
}

export function migrationCompletionState(
  migrationName: string,
  rows: DbMigrationRow[],
): MigrationCompletionState {
  const forName = rows.filter((r) => r.migration_name === migrationName)
  if (forName.length === 0) return 'MISSING'

  const hasCompleted = forName.some(
    (r) => r.rolled_back_at == null && r.finished_at != null,
  )
  if (hasCompleted) return 'COMPLETED'

  const hasIncomplete = forName.some(
    (r) => r.rolled_back_at == null && r.finished_at == null,
  )
  if (hasIncomplete) return 'INCOMPLETE'

  const hasRolledBack = forName.some((r) => r.rolled_back_at != null)
  if (hasRolledBack) return 'ROLLED_BACK'

  return 'MISSING'
}

export function analyzeMigrationCoverage(
  expected: string[],
  rows: DbMigrationRow[],
): MigrationCoverageSummary {
  const completed: string[] = []
  const missing: string[] = []
  const incomplete: string[] = []
  const rolledBack: string[] = []

  for (const name of expected) {
    switch (migrationCompletionState(name, rows)) {
      case 'COMPLETED':
        completed.push(name)
        break
      case 'INCOMPLETE':
        incomplete.push(name)
        break
      case 'ROLLED_BACK':
        rolledBack.push(name)
        break
      case 'MISSING':
        missing.push(name)
        break
    }
  }

  const status =
    missing.length === 0 &&
    incomplete.length === 0 &&
    rolledBack.length === 0 &&
    completed.length === expected.length
      ? 'PASS'
      : 'FAIL'

  return { expected, completed, missing, incomplete, rolledBack, status }
}

export function formatMigrationCoverageDetail(summary: MigrationCoverageSummary): string {
  const parts: string[] = []
  if (summary.missing.length) parts.push(`Missing: ${summary.missing.join(', ')}`)
  if (summary.incomplete.length) parts.push(`Incomplete/failed: ${summary.incomplete.join(', ')}`)
  if (summary.rolledBack.length) parts.push(`Rolled back: ${summary.rolledBack.join(', ')}`)
  if (summary.completed.length) {
    parts.push(`Completed (${summary.completed.length}/${summary.expected.length})`)
  }
  return parts.join('; ') || 'No expected migrations'
}

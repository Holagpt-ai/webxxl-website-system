import fs from 'node:fs'
import path from 'node:path'
import { allRepositoryMigrationFolders } from '@/lib/platform/pilot/migration-repository-chain'

export type MigrationOrderingIssueCode =
  | 'MISSING_SQL'
  | 'DUPLICATE_TIMESTAMP_PREFIX'
  | 'UNSORTED_CHAIN'
  | 'EMPTY_CHAIN'

export type MigrationOrderingIssue = {
  code: MigrationOrderingIssueCode
  message: string
  folders?: string[]
}

/** Read-only validation before owner-authorized `prisma migrate deploy` on staging. */
export function validateMigrationOrderingSafeguards(cwd = process.cwd()): {
  ok: boolean
  folderCount: number
  issues: MigrationOrderingIssue[]
  orderedFolders: string[]
} {
  const issues: MigrationOrderingIssue[] = []
  const orderedFolders = allRepositoryMigrationFolders(cwd)

  if (orderedFolders.length === 0) {
    issues.push({ code: 'EMPTY_CHAIN', message: 'No migration folders under prisma/migrations' })
    return { ok: false, folderCount: 0, issues, orderedFolders }
  }

  const sorted = [...orderedFolders].sort((a, b) => a.localeCompare(b))
  if (sorted.join('\0') !== orderedFolders.join('\0')) {
    issues.push({
      code: 'UNSORTED_CHAIN',
      message: 'Migration folders are not lexicographically sorted — Prisma apply order may drift from repository intent',
      folders: orderedFolders,
    })
  }

  const missingSql: string[] = []
  for (const folder of orderedFolders) {
    const sqlPath = path.join(cwd, 'prisma', 'migrations', folder, 'migration.sql')
    if (!fs.existsSync(sqlPath)) missingSql.push(folder)
  }
  if (missingSql.length) {
    issues.push({
      code: 'MISSING_SQL',
      message: 'Migration folder(s) missing migration.sql',
      folders: missingSql,
    })
  }

  const byPrefix = new Map<string, string[]>()
  for (const folder of orderedFolders) {
    const prefix = folder.slice(0, 14)
    const list = byPrefix.get(prefix) ?? []
    list.push(folder)
    byPrefix.set(prefix, list)
  }
  for (const [prefix, folders] of byPrefix) {
    if (folders.length > 1) {
      issues.push({
        code: 'DUPLICATE_TIMESTAMP_PREFIX',
        message: `Multiple migrations share timestamp prefix ${prefix}; apply order follows full folder name sort`,
        folders,
      })
    }
  }

  const blocking = issues.some((i) => i.code === 'MISSING_SQL' || i.code === 'EMPTY_CHAIN')
  return { ok: !blocking, folderCount: orderedFolders.length, issues, orderedFolders }
}

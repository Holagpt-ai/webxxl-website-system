import fs from 'node:fs'
import path from 'node:path'
import { allRepositoryMigrationFolders } from '@/lib/platform/pilot/migration-repository-chain'

export type MigrationOrderingIssueCode =
  | 'MISSING_SQL'
  | 'UTF8_BOM_IN_SQL'
  | 'SINGLE_LINE_MIGRATION_SQL'
  | 'INLINE_PRISMA_COMMENT_DDL'
  | 'DUPLICATE_TIMESTAMP_PREFIX'
  | 'UNSORTED_CHAIN'
  | 'EMPTY_CHAIN'

const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf])

function migrationSqlHasUtf8Bom(sqlPath: string): boolean {
  const head = fs.readFileSync(sqlPath).subarray(0, 3)
  return head.length >= 3 && head.equals(UTF8_BOM)
}

/** Postgres `--` comments to end-of-line; one-line files with `-- CreateEnum CREATE …` execute zero DDL. */
const INLINE_PRISMA_COMMENT_DDL = /-- Create(Enum|Table|Index|ForeignKey)\s+CREATE/i

function migrationSqlIsSingleLineSwallowed(sqlPath: string): boolean {
  const raw = fs.readFileSync(sqlPath, 'utf8')
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length !== 1) return false
  return lines[0]!.length > 200 && INLINE_PRISMA_COMMENT_DDL.test(lines[0]!)
}

/** Any physical line where `-- CreateEnum CREATE TYPE …` makes Postgres ignore the DDL token. */
function migrationSqlInlineSwallowedLineCount(sqlPath: string): number {
  const raw = fs.readFileSync(sqlPath, 'utf8')
  return raw.split(/\r?\n/).filter((line) => INLINE_PRISMA_COMMENT_DDL.test(line)).length
}

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
  const bomInSql: string[] = []
  const singleLineSql: string[] = []
  const inlineCommentDdl: string[] = []
  for (const folder of orderedFolders) {
    const sqlPath = path.join(cwd, 'prisma', 'migrations', folder, 'migration.sql')
    if (!fs.existsSync(sqlPath)) missingSql.push(folder)
    else if (migrationSqlHasUtf8Bom(sqlPath)) bomInSql.push(folder)
    else if (migrationSqlIsSingleLineSwallowed(sqlPath)) singleLineSql.push(folder)
    else if (migrationSqlInlineSwallowedLineCount(sqlPath) > 0) inlineCommentDdl.push(folder)
  }
  if (missingSql.length) {
    issues.push({
      code: 'MISSING_SQL',
      message: 'Migration folder(s) missing migration.sql',
      folders: missingSql,
    })
  }
  if (bomInSql.length) {
    issues.push({
      code: 'UTF8_BOM_IN_SQL',
      message:
        'migration.sql must be UTF-8 without BOM (Postgres rejects U+FEFF); strip EF BB BF from affected files',
      folders: bomInSql,
    })
  }
  if (singleLineSql.length) {
    issues.push({
      code: 'SINGLE_LINE_MIGRATION_SQL',
      message:
        'migration.sql is a single physical line with inline Prisma comments — Postgres treats the entire file as one comment; split statements onto separate lines',
      folders: singleLineSql,
    })
  }
  if (inlineCommentDdl.length) {
    issues.push({
      code: 'INLINE_PRISMA_COMMENT_DDL',
      message:
        'migration.sql line(s) combine Prisma `-- Create*` comments with CREATE on the same physical line — Postgres comments out the DDL; put comments on their own line',
      folders: inlineCommentDdl,
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

  const blocking = issues.some(
    (i) =>
      i.code === 'MISSING_SQL' ||
      i.code === 'UTF8_BOM_IN_SQL' ||
      i.code === 'SINGLE_LINE_MIGRATION_SQL' ||
      i.code === 'INLINE_PRISMA_COMMENT_DDL' ||
      i.code === 'EMPTY_CHAIN',
  )
  return { ok: !blocking, folderCount: orderedFolders.length, issues, orderedFolders }
}

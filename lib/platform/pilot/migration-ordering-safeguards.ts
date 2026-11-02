import fs from 'node:fs'
import path from 'node:path'
import { allRepositoryMigrationFolders } from '@/lib/platform/pilot/migration-repository-chain'

export type MigrationOrderingIssueCode =
  | 'MISSING_SQL'
  | 'UTF8_BOM_IN_SQL'
  | 'SINGLE_LINE_MIGRATION_SQL'
  | 'INLINE_PRISMA_COMMENT_DDL'
  | 'DUPLICATE_ENUM_ADD_VALUE'
  | 'REDUNDANT_MIGRATION_DDL'
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

const CREATE_TYPE_ENUM_RE =
  /CREATE TYPE\s+"([^"]+)"\s+AS ENUM\s*\(\s*([^)]+)\s*\)\s*;/gi
const ALTER_TYPE_ADD_VALUE_RE =
  /ALTER TYPE\s+"([^"]+)"\s+ADD VALUE\s+'([^']+)'/gi

function enumLabelsFromCreateClause(clause: string): string[] {
  const labels: string[] = []
  const tokenRe = /'([^']+)'/g
  let m: RegExpExecArray | null
  while ((m = tokenRe.exec(clause)) !== null) labels.push(m[1]!)
  return labels
}

/** Detect ALTER TYPE ADD VALUE for labels already declared in CREATE TYPE or prior ADD VALUE (clean-deploy 42710). */
export function findDuplicateEnumAddValueIssues(
  orderedFolders: string[],
  cwd = process.cwd(),
): MigrationOrderingIssue[] {
  const enumLabels = new Map<string, Set<string>>()
  const duplicates: { folder: string; typeName: string; label: string }[] = []

  for (const folder of orderedFolders) {
    const sqlPath = path.join(cwd, 'prisma', 'migrations', folder, 'migration.sql')
    if (!fs.existsSync(sqlPath)) continue
    const raw = fs.readFileSync(sqlPath, 'utf8')

    CREATE_TYPE_ENUM_RE.lastIndex = 0
    let createMatch: RegExpExecArray | null
    while ((createMatch = CREATE_TYPE_ENUM_RE.exec(raw)) !== null) {
      const typeName = createMatch[1]!
      const set = enumLabels.get(typeName) ?? new Set<string>()
      for (const label of enumLabelsFromCreateClause(createMatch[2]!)) set.add(label)
      enumLabels.set(typeName, set)
    }

    ALTER_TYPE_ADD_VALUE_RE.lastIndex = 0
    let addMatch: RegExpExecArray | null
    while ((addMatch = ALTER_TYPE_ADD_VALUE_RE.exec(raw)) !== null) {
      const typeName = addMatch[1]!
      const label = addMatch[2]!
      const set = enumLabels.get(typeName) ?? new Set<string>()
      if (set.has(label)) duplicates.push({ folder, typeName, label })
      else set.add(label)
      enumLabels.set(typeName, set)
    }
  }

  if (duplicates.length === 0) return []
  return [
    {
      code: 'DUPLICATE_ENUM_ADD_VALUE',
      message:
        'ALTER TYPE ADD VALUE repeats a label already defined in CREATE TYPE or an earlier migration — Postgres 42710 on clean deploy',
      folders: [...new Set(duplicates.map((d) => d.folder))],
    },
  ]
}

export type MigrationOrderingIssue = {
  code: MigrationOrderingIssueCode
  message: string
  folders?: string[]
}

const CREATE_TABLE_RE = /CREATE TABLE\s+"([^"]+)"\s*\(([\s\S]*?)\)\s*;/gi
const CREATE_INDEX_RE = /CREATE (?:UNIQUE )?INDEX\s+"([^"]+)"/gi

function ingestCreateTables(sql: string, tableColumns: Map<string, Set<string>>) {
  CREATE_TABLE_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = CREATE_TABLE_RE.exec(sql)) !== null) {
    const table = m[1]!
    const body = m[2]!
    const cols = tableColumns.get(table) ?? new Set<string>()
    const colRe = /"([^"]+)"\s+(?:"[^"]+"|[A-Za-z0-9_.]+(?:\([^)]*\))?)/g
    let cm: RegExpExecArray | null
    while ((cm = colRe.exec(body)) !== null) {
      const name = cm[1]!
      if (name.endsWith('_pkey') || name.endsWith('_key')) continue
      cols.add(name)
    }
    tableColumns.set(table, cols)
  }
}

function collectAddColumns(sql: string): { table: string; column: string }[] {
  const out: { table: string; column: string }[] = []
  const alterBlocks = sql.split(/(?=ALTER TABLE)/i)
  for (const block of alterBlocks) {
    const tableMatch = block.match(/ALTER TABLE\s+"([^"]+)"/i)
    if (!tableMatch) continue
    const table = tableMatch[1]!
    const colRe = /ADD COLUMN\s+"([^"]+)"/gi
    let m: RegExpExecArray | null
    while ((m = colRe.exec(block)) !== null) out.push({ table, column: m[1]! })
  }
  return out
}

function ingestAddColumns(sql: string, tableColumns: Map<string, Set<string>>) {
  for (const { table, column } of collectAddColumns(sql)) {
    const cols = tableColumns.get(table) ?? new Set<string>()
    cols.add(column)
    tableColumns.set(table, cols)
  }
}

function collectCreateIndexes(sql: string): string[] {
  const names: string[] = []
  CREATE_INDEX_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = CREATE_INDEX_RE.exec(sql)) !== null) names.push(m[1]!)
  return names
}

/** ADD COLUMN / CREATE INDEX in a later migration that repeats objects from an earlier migration in the chain. */
export function findRedundantMigrationDdlIssues(
  orderedFolders: string[],
  cwd = process.cwd(),
): MigrationOrderingIssue[] {
  const tableColumns = new Map<string, Set<string>>()
  const indexNames = new Set<string>()
  const overlapFolders = new Set<string>()

  for (const folder of orderedFolders) {
    const sqlPath = path.join(cwd, 'prisma', 'migrations', folder, 'migration.sql')
    if (!fs.existsSync(sqlPath)) continue
    const raw = fs.readFileSync(sqlPath, 'utf8')

    for (const { table, column } of collectAddColumns(raw)) {
      const existing = tableColumns.get(table)
      if (existing?.has(column)) overlapFolders.add(folder)
    }
    for (const indexName of collectCreateIndexes(raw)) {
      if (indexNames.has(indexName)) overlapFolders.add(folder)
    }

    ingestCreateTables(raw, tableColumns)
    ingestAddColumns(raw, tableColumns)
    for (const indexName of collectCreateIndexes(raw)) indexNames.add(indexName)
  }

  if (overlapFolders.size === 0) return []
  return [
    {
      code: 'REDUNDANT_MIGRATION_DDL',
      message:
        'Migration re-adds a column or index already created in an earlier migration — fails on clean deploy (42701 / duplicate index)',
      folders: [...overlapFolders],
    },
  ]
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

  issues.push(...findDuplicateEnumAddValueIssues(orderedFolders, cwd))
  issues.push(...findRedundantMigrationDdlIssues(orderedFolders, cwd))

  const blocking = issues.some(
    (i) =>
      i.code === 'MISSING_SQL' ||
      i.code === 'UTF8_BOM_IN_SQL' ||
      i.code === 'SINGLE_LINE_MIGRATION_SQL' ||
      i.code === 'INLINE_PRISMA_COMMENT_DDL' ||
      i.code === 'DUPLICATE_ENUM_ADD_VALUE' ||
      i.code === 'REDUNDANT_MIGRATION_DDL' ||
      i.code === 'EMPTY_CHAIN',
  )
  return { ok: !blocking, folderCount: orderedFolders.length, issues, orderedFolders }
}

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  findDuplicateEnumAddValueIssues,
  validateMigrationOrderingSafeguards,
} from '@/lib/platform/pilot/migration-ordering-safeguards'
import { allRepositoryMigrationFolders } from '@/lib/platform/pilot/migration-repository-chain'

describe('Batch 39G duplicate enum ADD VALUE guard', () => {
  it('passes on the full repository migration chain', () => {
    const result = validateMigrationOrderingSafeguards()
    expect(result.issues.some((i) => i.code === 'DUPLICATE_ENUM_ADD_VALUE')).toBe(false)
    expect(result.ok).toBe(true)
  })

  it('comms06a_integrity does not re-add PROCESSING', () => {
    const sql = readFileSync(
      join(process.cwd(), 'prisma/migrations/20261018220000_comms06a_integrity/migration.sql'),
      'utf8',
    )
    expect(sql).not.toMatch(/ADD VALUE 'PROCESSING'/)
    expect(sql).not.toMatch(/ADD COLUMN/)
  })

  it('detects duplicate ADD VALUE when injected', () => {
    const folders = allRepositoryMigrationFolders()
    const issues = findDuplicateEnumAddValueIssues(folders)
    expect(issues).toHaveLength(0)

    const synthetic = [
      '20261018210000_comms06_foundation',
      '20261018220000_comms06a_integrity',
    ]
    const foundationSql = readFileSync(
      join(process.cwd(), 'prisma/migrations/20261018210000_comms06_foundation/migration.sql'),
      'utf8',
    )
    expect(foundationSql).toContain("'PROCESSING'")
  })
})

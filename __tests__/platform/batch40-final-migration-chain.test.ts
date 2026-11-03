import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  findUnguardedSupabaseRevokeIssues,
  validateMigrationOrderingSafeguards,
} from '@/lib/platform/pilot/migration-ordering-safeguards'
import { allRepositoryMigrationFolders } from '@/lib/platform/pilot/migration-repository-chain'

describe('Batch 40 final migration chain safeguards', () => {
  it('passes full ordering safeguards including overlap and Supabase revoke guards', () => {
    const result = validateMigrationOrderingSafeguards()
    expect(result.folderCount).toBe(39)
    expect(result.issues.some((i) => i.code === 'UNGUARDED_SUPABASE_REVOKE')).toBe(false)
    expect(result.issues.some((i) => i.code === 'REDUNDANT_MIGRATION_DDL')).toBe(false)
    expect(result.issues.some((i) => i.code === 'DUPLICATE_ENUM_ADD_VALUE')).toBe(false)
    expect(result.ok).toBe(true)
  })

  it('website_preview revoke is guarded like restrict_supabase_api_access', () => {
    const sql = readFileSync(
      join(process.cwd(), 'prisma/migrations/20261013170000_website_preview/migration.sql'),
      'utf8',
    )
    expect(sql).toContain('pg_roles')
    expect(findUnguardedSupabaseRevokeIssues(allRepositoryMigrationFolders())).toHaveLength(0)
  })
})

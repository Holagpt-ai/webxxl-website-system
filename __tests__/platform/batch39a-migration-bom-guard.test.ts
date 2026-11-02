import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { validateMigrationOrderingSafeguards } from '@/lib/platform/pilot/migration-ordering-safeguards'

describe('Batch 39A migration BOM guard', () => {
  it('passes when no migration.sql contains UTF-8 BOM or single-line swallowed SQL', () => {
    const result = validateMigrationOrderingSafeguards()
    expect(result.issues.some((i) => i.code === 'UTF8_BOM_IN_SQL')).toBe(false)
    expect(result.issues.some((i) => i.code === 'SINGLE_LINE_MIGRATION_SQL')).toBe(false)
    expect(result.ok).toBe(true)
  })

  it('fails when a migration.sql contains UTF-8 BOM', () => {
    const sqlPath = join(
      process.cwd(),
      'prisma/migrations/20251008120000_customer_portal_core/migration.sql',
    )
    const original = readFileSync(sqlPath)
    writeFileSync(sqlPath, Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), original]))
    try {
      const result = validateMigrationOrderingSafeguards()
      expect(result.ok).toBe(false)
      const bom = result.issues.find((i) => i.code === 'UTF8_BOM_IN_SQL')
      expect(bom?.folders).toContain('20251008120000_customer_portal_core')
    } finally {
      writeFileSync(sqlPath, original)
    }
  })
})

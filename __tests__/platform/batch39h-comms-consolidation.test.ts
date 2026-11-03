import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  findRedundantMigrationDdlIssues,
  validateMigrationOrderingSafeguards,
} from '@/lib/platform/pilot/migration-ordering-safeguards'
import { allRepositoryMigrationFolders } from '@/lib/platform/pilot/migration-repository-chain'

describe('Batch 39H comms06 foundation/integrity consolidation', () => {
  it('passes redundant DDL guard across full chain', () => {
    const result = validateMigrationOrderingSafeguards()
    expect(result.issues.some((i) => i.code === 'REDUNDANT_MIGRATION_DDL')).toBe(false)
    expect(result.ok).toBe(true)
  })

  it('comms06a_integrity only drops legacy index idempotently', () => {
    const sql = readFileSync(
      join(process.cwd(), 'prisma/migrations/20261018220000_comms06a_integrity/migration.sql'),
      'utf8',
    )
    expect(sql).not.toMatch(/ADD COLUMN/)
    expect(sql).not.toMatch(/CREATE (UNIQUE )?INDEX/)
    expect(sql).not.toMatch(/ADD VALUE/)
    expect(sql).toContain('DROP INDEX IF EXISTS "CommsWebhookReceipt_providerKey_externalEventId_key"')
  })

  it('foundation defines CommsWebhookReceipt integrity columns and indexes', () => {
    const sql = readFileSync(
      join(process.cwd(), 'prisma/migrations/20261018210000_comms06_foundation/migration.sql'),
      'utf8',
    )
    for (const col of [
      'tenantMappingId',
      'externalAccountId',
      'eventDedupeKey',
      'relayTimestampSeconds',
      'claimedAt',
      'claimedBy',
    ]) {
      expect(sql).toContain(`"${col}"`)
    }
    expect(sql).toContain('CREATE UNIQUE INDEX "CommsWebhookReceipt_eventDedupeKey_key"')
    expect(sql).toContain(
      'CREATE INDEX "CommsWebhookReceipt_providerKey_providerInstanceId_externalA_idx"',
    )
  })

  it('detects injected redundant ADD COLUMN after foundation', () => {
    const folders = allRepositoryMigrationFolders()
    const issues = findRedundantMigrationDdlIssues(folders)
    expect(issues).toHaveLength(0)
  })
})

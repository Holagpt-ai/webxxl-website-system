import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ABMED_AESTHETICS_ACCOUNT_ID, ABMED_PHYSICIANS_ACCOUNT_ID } from '@/lib/platform/fixtures/abmed'
import {
  analyzeImportRows,
  summarizeImportAnalysis,
  validateImportFieldMapping,
} from '@/lib/platform/crm/import-analysis'
import { paginateStableIds } from '@/lib/platform/crm/export-pagination'
import { importMustNotGrantConsent } from '@/lib/platform/crm/consent-service'
import {
  evaluateSegmentGroup,
  parseSegmentFilterDate,
  summarizeSegmentPopulation,
  validateSegmentFilterGroup,
} from '@/lib/platform/crm/segment-engine'
import { buildSynthetic200ContactSegmentFixture } from '@/lib/platform/crm/test-fixtures-200'
import { rejectCrossAccountMerge } from '@/lib/platform/crm/dedup-service'

describe('Batch 23 CRM data operations', () => {
  beforeEach(() => {
    vi.stubEnv('CRM_IMPORT_ENABLED', 'true')
    vi.stubEnv('CRM_EXPORT_ENABLED', 'true')
  })
  afterEach(() => vi.unstubAllEnvs())

  it('validates import mapping and detects in-file and existing duplicates', () => {
    const mapping = { email: 'Email', givenName: 'First' }
    expect(validateImportFieldMapping(mapping).ok).toBe(true)
    const analyses = analyzeImportRows({
      rows: [
        { Email: 'dup@example.com', First: 'A' },
        { Email: 'dup@example.com', First: 'B' },
        { Email: 'new@example.com', First: 'C' },
        { Email: 'bad', First: 'D' },
      ],
      mapping,
      existingEmailToContactId: new Map([['new@example.com', 'contact_existing']]),
    })
    const summary = summarizeImportAnalysis(analyses)
    expect(summary.duplicateInFile).toBe(1)
    expect(summary.duplicateExisting).toBe(1)
    expect(summary.rejected).toBe(1)
    expect(summary.ready).toBe(1)
    expect(analyses[1]?.disposition.kind).toBe('duplicate_in_file')
    expect(analyses[2]?.disposition.kind).toBe('duplicate_existing')
  })

  it('never grants marketing consent during import', () => {
    expect(importMustNotGrantConsent().ok).toBe(true)
  })

  it('paginates export ids without omission or duplication across pages', () => {
    const ids = ['c1', 'c2', 'c3', 'c4', 'c5']
    const page1 = paginateStableIds(ids, undefined, 2)
    expect(page1.pageIds).toEqual(['c1', 'c2'])
    expect(page1.nextCursor).toBe('c2')
    const page2 = paginateStableIds(ids, page1.nextCursor, 2)
    expect(page2.pageIds).toEqual(['c3', 'c4'])
    expect(page2.nextCursor).toBe('c4')
    const page3 = paginateStableIds(ids, page2.nextCursor, 2)
    expect(page3.pageIds).toEqual(['c5'])
    expect(page3.nextCursor).toBeUndefined()
    const all = [...page1.pageIds, ...page2.pageIds, ...page3.pageIds]
    expect(all).toEqual(ids)
  })

  it('uses filtered population summary semantics for segment matches', () => {
    const fixture = buildSynthetic200ContactSegmentFixture(ABMED_AESTHETICS_ACCOUNT_ID)
    const vip = fixture.filter((c) => evaluateSegmentGroup(c, { logic: 'AND', rules: [{ field: 'tag', operator: 'eq', value: 'vip' }] }))
    const vipSummary = summarizeSegmentPopulation(vip)
    expect(vipSummary.totalContacts).toBe(20)
    expect(vipSummary.matchedContacts).toBe(20)
    const accountSummary = summarizeSegmentPopulation(fixture)
    expect(accountSummary.totalContacts).toBe(200)
    expect(vipSummary.eligibleContacts).toBeLessThanOrEqual(accountSummary.eligibleContacts)
  })

  it('rejects invalid segment date filters', () => {
    const invalid = validateSegmentFilterGroup({
      logic: 'AND',
      rules: [{ field: 'createdAfter', operator: 'gte', value: 'not-a-date' }],
    })
    expect(invalid.ok).toBe(false)
    expect(parseSegmentFilterDate('2026-01-01T00:00:00.000Z')).toBeInstanceOf(Date)
  })

  it('denies cross-account merge authorization', async () => {
    const denied = await rejectCrossAccountMerge(ABMED_AESTHETICS_ACCOUNT_ID, ABMED_PHYSICIANS_ACCOUNT_ID)
    expect(denied.ok).toBe(false)
    if (!denied.ok) expect(denied.code).toBe('CROSS_ACCOUNT_DENIED')
  })

  it('import commit idempotency replay returns stored outcome', async () => {
    vi.doMock('@/lib/db', () => ({
      prisma: {
        crmImportJob: {
          findFirst: async () => ({
            id: 'job_a',
            customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
            status: 'COMMITTED',
            committedContactCount: 2,
            previewReport: {
              outcome: { committed: 2, skipped: 1, rejected: 0, duplicates: 3, jobId: 'job_a', importedCount: 2 },
            },
          }),
        },
        crmDataAccessAudit: { create: async () => ({}) },
        $transaction: async () => {
          throw new Error('should not tx on replay')
        },
      },
    }))
    vi.doMock('@/config/crm-backend', () => ({ isCrmImportEnabled: () => true }))
    const { commitCrmImport } = await import('@/lib/platform/crm/import-export-service')
    const replay = await commitCrmImport({
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      jobId: 'job_a',
      commitIdempotencyKey: 'commit-key',
      actorUserId: 'user_1',
    })
    expect(replay.ok).toBe(true)
    if (replay.ok) {
      expect(replay.value.committed).toBe(2)
      expect(replay.value.duplicates).toBe(3)
    }
  })
})

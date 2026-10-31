import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ABMED_AESTHETICS_ACCOUNT_ID } from '@/lib/platform/fixtures/abmed'
import {
  analyzeImportRows,
  buildLegacyImportDuplicates,
  classifyImportRowForCommit,
  importRowPersistenceFromAnalysis,
  normalizeImportMapping,
} from '@/lib/platform/crm/import-analysis'
import { previewCrmImportResponseShape, commitCrmImportResponseShape } from '@/lib/platform/crm/import-api-contract'

describe('Batch 23.1 CRM corrections', () => {
  beforeEach(() => {
    vi.stubEnv('CRM_IMPORT_ENABLED', 'true')
    vi.stubEnv('CRM_EXPORT_ENABLED', 'true')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('F2: accepts legacy UI target-to-column mapping and builds legacy duplicates list', () => {
    const uiMapping = { email: 'Email', givenName: 'First' }
    const canonical = normalizeImportMapping(uiMapping)
    expect(canonical).toEqual({ Email: 'email', First: 'givenName' })
    const analyses = analyzeImportRows({
      rows: [
        { Email: 'a@example.com', First: 'A' },
        { Email: 'a@example.com', First: 'B' },
      ],
      mapping: uiMapping,
      existingEmailToContactId: new Map(),
    })
    const duplicates = buildLegacyImportDuplicates(analyses)
    expect(duplicates).toEqual([{ rowNumber: 2, email: 'a@example.com' }])
    expect(previewCrmImportResponseShape({ duplicates, rowCount: 2, consentGranted: false })).toBe(true)
  })

  it('F1: skipped empty rows never commit as contacts', async () => {
    const uiMapping = { email: 'Email' }
    const rows = [{ Email: '' }, { Email: 'ready@example.com' }]
    const analyses = analyzeImportRows({
      rows,
      mapping: uiMapping,
      existingEmailToContactId: new Map(),
    })
    expect(analyses[0]?.disposition.kind).toBe('skipped')
    const persisted = importRowPersistenceFromAnalysis(analyses[0]!)
    expect(classifyImportRowForCommit(
      {
        duplicateCandidateId: persisted.duplicateCandidateId ?? null,
        validationErrors: persisted.validationErrors,
        normalizedData: persisted.normalizedData,
        rawData: rows[0],
      },
      uiMapping,
    )).toBe('skip')

    const createdContacts: string[] = []
    vi.doMock('@/lib/db', () => ({
      prisma: {
        crmContactChannelIdentity: { findMany: async () => [] },
        crmImportJob: {
          findFirst: async ({ where }: { where: { commitIdempotencyKey?: string } }) => {
            if (where.commitIdempotencyKey) return null
            return null
          },
        },
        crmDataAccessAudit: { create: async () => ({}) },
        $transaction: async (fn: (tx: unknown) => Promise<void>) => {
          const tx = {
            crmImportJob: {
              updateMany: async () => ({ count: 1 }),
              findFirst: async () => ({
                id: 'job_1',
                customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
                status: 'PREVIEW',
                mapping: normalizeImportMapping(uiMapping),
                previewReport: {},
                rows: [
                  {
                    id: 'row_1',
                    rowNumber: 1,
                    committedContactId: null,
                    duplicateCandidateId: null,
                    validationErrors: persisted.validationErrors,
                    normalizedData: persisted.normalizedData,
                    rawData: rows[0],
                  },
                  {
                    id: 'row_2',
                    rowNumber: 2,
                    committedContactId: null,
                    duplicateCandidateId: null,
                    validationErrors: undefined,
                    normalizedData: { email: 'ready@example.com', emailNormalized: 'ready@example.com' },
                    rawData: rows[1],
                  },
                ],
              }),
              update: async () => ({}),
            },
            crmContactChannelIdentity: {
              findFirst: async () => null,
              create: async () => ({}),
            },
            crmContact: {
              create: async () => {
                createdContacts.push('created')
                return { id: 'contact_1' }
              },
            },
            crmImportRow: { update: async () => ({}) },
          }
          await fn(tx)
        },
      },
    }))
    vi.doMock('@/config/crm-backend', () => ({
      isCrmImportEnabled: () => true,
      CRM_IMPORT_MAX_ROWS: 5000,
      CRM_IMPORT_MAX_FIELDS: 40,
    }))
    const { commitCrmImport } = await import('@/lib/platform/crm/import-export-service')
    const result = await commitCrmImport({
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      jobId: 'job_1',
      commitIdempotencyKey: 'idem-empty-row',
      actorUserId: 'user_1',
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.committed).toBe(1)
      expect(result.value.skipped).toBe(1)
      expect(result.value.importedCount).toBe(1)
      expect(commitCrmImportResponseShape(result.value)).toBe(true)
    }
    expect(createdContacts).toHaveLength(1)
  })

  it('F3: existing phone identity is treated as duplicate instead of aborting commit', () => {
    const mapping = { Phone: 'phone', Name: 'givenName' }
    const analyses = analyzeImportRows({
      rows: [{ Phone: '3055550100', Name: 'Pat' }],
      mapping,
      existingEmailToContactId: new Map(),
      existingPhoneToContactId: new Map([['+13055550100', 'contact_phone']]),
    })
    expect(analyses[0]?.disposition.kind).toBe('duplicate_existing')
  })

  it('F4: competing merge decisions cannot both succeed', async () => {
    let status = 'PENDING'
    vi.doMock('@/lib/db', () => ({
      prisma: {
        $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
          fn({
            crmMergeProposal: {
              updateMany: async ({ data }: { data: { status: string } }) => {
                if (status !== 'PENDING') return { count: 0 }
                status = data.status
                return { count: 1 }
              },
              findFirst: async () => ({
                id: 'proposal_1',
                customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
                primaryContactId: 'primary',
                duplicateContactId: 'duplicate',
                confidenceBps: 9000,
                status,
              }),
              update: async ({ data }: { data: { status: string } }) => {
                status = data.status
                return {}
              },
            },
            crmContact: {
              findFirst: async ({ where }: { where: { id: string } }) => ({
                id: where.id,
                customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
                status: 'ACTIVE',
              }),
              update: async () => ({}),
            },
            crmTimelineEvent: { updateMany: async () => ({ count: 0 }) },
            crmContactNote: { updateMany: async () => ({ count: 0 }) },
            crmTask: { updateMany: async () => ({ count: 0 }) },
            crmDeal: { updateMany: async () => ({ count: 0 }) },
            crmContactSource: { updateMany: async () => ({ count: 0 }) },
            contactConsent: { findMany: async () => [], findFirst: async () => null, update: async () => ({}), delete: async () => ({}) },
            contactSuppression: { findMany: async () => [], findFirst: async () => null, update: async () => ({}), delete: async () => ({}) },
            chatwootContactMapping: { findFirst: async () => null, findMany: async () => [], update: async () => ({}), delete: async () => ({}) },
            chatwootConversationMapping: { updateMany: async () => ({ count: 0 }) },
            marketingLeadFollowUpEvaluation: { updateMany: async () => ({ count: 0 }) },
            marketingFollowUpTaskIntent: { findMany: async () => [], findFirst: async () => null, update: async () => ({}), delete: async () => ({}) },
            crmContactChannelIdentity: { findMany: async () => [] },
            crmContactTag: { findMany: async () => [] },
            crmSegmentMember: { findMany: async () => [] },
            crmContactCompanyRelationship: { findMany: async () => [] },
            crmContactMergeAudit: { create: async () => ({}) },
          }),
        crmMergeProposal: {
          findFirst: async () => ({ id: 'proposal_1', customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID, status }),
        },
      },
    }))
    const { approveMergeProposal, rejectMergeProposal } = await import('@/lib/platform/crm/dedup-service')
    const approved = await approveMergeProposal({
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      proposalId: 'proposal_1',
      actorUserId: 'owner',
    })
    expect(approved.ok).toBe(true)
    const rejected = await rejectMergeProposal({
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      proposalId: 'proposal_1',
      actorUserId: 'owner',
    })
    expect(rejected.ok).toBe(false)
  })

  it('F4: second approve on resolved proposal is rejected', async () => {
    vi.doMock('@/lib/db', () => ({
      prisma: {
        $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
          fn({
            crmMergeProposal: {
              updateMany: async () => ({ count: 0 }),
            },
          }),
      },
    }))
    const { approveMergeProposal } = await import('@/lib/platform/crm/dedup-service')
    const second = await approveMergeProposal({
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      proposalId: 'proposal_1',
      actorUserId: 'owner',
    })
    expect(second.ok).toBe(false)
    if (!second.ok) expect(second.code).toBe('CONFLICT')
  })

  it('F4: consent conflicts fail closed instead of deleting duplicate consent', async () => {
    vi.doMock('@/lib/db', () => ({
      prisma: {
        $transaction: async (fn: (tx: unknown) => Promise<void>) =>
          fn({
            contactConsent: {
              findMany: async ({ where }: { where: { contactId: string } }) => {
                if (where.contactId === 'primary') {
                  return [
                    {
                      id: 'primary_consent',
                      channel: 'EMAIL',
                      purpose: 'MARKETING',
                      status: 'REVOKED',
                      capturedAt: new Date('2026-10-02T00:00:00Z'),
                      source: 'form',
                      termsVersion: 'v1',
                      evidence: [{ id: 'ev_primary', evidenceRef: 'ref-primary' }],
                    },
                  ]
                }
                return [
                  {
                    id: 'dup_consent',
                    channel: 'EMAIL',
                    purpose: 'MARKETING',
                    status: 'GRANTED',
                    capturedAt: new Date('2026-10-03T00:00:00Z'),
                    source: 'import',
                    termsVersion: 'v1',
                    evidence: [{ id: 'ev_dup', evidenceRef: 'ref-dup' }],
                  },
                ]
              },
              update: async () => {
                throw new Error('should not mutate consent on conflict')
              },
            },
            contactSuppression: { findMany: async () => [] },
            chatwootContactMapping: { findFirst: async () => null },
          }),
      },
    }))
    const { applyConsentMergePreservation } = await import('@/lib/platform/crm/dedup-service')
    const result = await applyConsentMergePreservation(ABMED_AESTHETICS_ACCOUNT_ID, 'duplicate', 'primary')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('CONFLICT')
  })
})

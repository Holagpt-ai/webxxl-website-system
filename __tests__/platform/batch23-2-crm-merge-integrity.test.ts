import { afterEach, describe, expect, it, vi } from 'vitest'
import { ABMED_AESTHETICS_ACCOUNT_ID } from '@/lib/platform/fixtures/abmed'
import {
  evaluateMergeChatwootCompatibility,
  evaluateMergeConsentCompatibility,
  isMarketingOutreachGranted,
} from '@/lib/platform/crm/merge-preflight'

const d = (iso: string) => new Date(iso)

describe('Batch 23.2 CRM merge integrity', () => {
  afterEach(() => vi.resetModules())

  it('preserves consent evidence by moving records instead of deleting them', async () => {
    const updates: string[] = []
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
                      status: 'GRANTED',
                      capturedAt: d('2026-10-01T00:00:00Z'),
                      source: 'form',
                      termsVersion: 'v2',
                      evidence: [{ id: 'ev1', evidenceRef: 'proof-1' }],
                    },
                  ]
                }
                return [
                  {
                    id: 'dup_consent',
                    channel: 'EMAIL',
                    purpose: 'MARKETING',
                    status: 'GRANTED',
                    capturedAt: d('2026-09-01T00:00:00Z'),
                    source: 'legacy',
                    termsVersion: 'v1',
                    evidence: [{ id: 'ev2', evidenceRef: 'proof-2' }],
                  },
                ]
              },
              update: async ({ where }: { where: { id: string } }) => {
                updates.push(where.id)
                return {}
              },
            },
            contactSuppression: { findMany: async () => [] },
            chatwootContactMapping: { findFirst: async () => null },
          }),
      },
    }))
    const { applyConsentMergePreservation } = await import('@/lib/platform/crm/dedup-service')
    const result = await applyConsentMergePreservation(ABMED_AESTHETICS_ACCOUNT_ID, 'duplicate', 'primary')
    expect(result.ok).toBe(true)
    expect(updates).toEqual(['dup_consent'])
  })

  it('blocks survivor REVOKED versus newer duplicate GRANTED', () => {
    const conflict = evaluateMergeConsentCompatibility({
      survivorConsents: [
        { channel: 'EMAIL', purpose: 'MARKETING', status: 'REVOKED', capturedAt: d('2026-10-01T00:00:00Z'), source: 'form' },
      ],
      duplicateConsents: [
        { channel: 'EMAIL', purpose: 'MARKETING', status: 'GRANTED', capturedAt: d('2026-10-03T00:00:00Z'), source: 'import' },
      ],
      survivorSuppressions: [],
      duplicateSuppressions: [],
    })
    expect(conflict?.kind).toBe('consent')
  })

  it('allows survivor GRANTED versus newer duplicate REVOKED', () => {
    const conflict = evaluateMergeConsentCompatibility({
      survivorConsents: [
        { channel: 'EMAIL', purpose: 'MARKETING', status: 'GRANTED', capturedAt: d('2026-10-01T00:00:00Z'), source: 'form' },
      ],
      duplicateConsents: [
        { channel: 'EMAIL', purpose: 'MARKETING', status: 'REVOKED', capturedAt: d('2026-10-03T00:00:00Z'), source: 'import' },
      ],
      survivorSuppressions: [],
      duplicateSuppressions: [],
    })
    expect(conflict).toBeNull()
    expect(
      isMarketingOutreachGranted(
        [
          { channel: 'EMAIL', purpose: 'MARKETING', status: 'GRANTED', capturedAt: d('2026-10-01T00:00:00Z'), source: 'form' },
          { channel: 'EMAIL', purpose: 'MARKETING', status: 'REVOKED', capturedAt: d('2026-10-03T00:00:00Z'), source: 'import' },
        ],
        [],
      ),
    ).toBe(false)
  })

  it('preserves active suppression provenance by moving duplicate suppression rows', async () => {
    const moved: string[] = []
    vi.doMock('@/lib/db', () => ({
      prisma: {
        $transaction: async (fn: (tx: unknown) => Promise<void>) =>
          fn({
            contactConsent: { findMany: async () => [] },
            contactSuppression: {
              findMany: async ({ where }: { where: { contactId: string } }) =>
                where.contactId === 'duplicate'
                  ? [
                      {
                        id: 'sup_1',
                        channel: 'EMAIL',
                        purpose: 'MARKETING',
                        active: true,
                        source: 'unsubscribe',
                        reason: 'user opt-out',
                      },
                    ]
                  : [],
              update: async ({ where }: { where: { id: string } }) => {
                moved.push(where.id)
                return {}
              },
            },
            chatwootContactMapping: { findFirst: async () => null },
          }),
      },
    }))
    const { applyConsentMergePreservation } = await import('@/lib/platform/crm/dedup-service')
    const result = await applyConsentMergePreservation(ABMED_AESTHETICS_ACCOUNT_ID, 'duplicate', 'primary')
    expect(result.ok).toBe(true)
    expect(moved).toEqual(['sup_1'])
  })

  it('returns Chatwoot reconciliation conflict when both contacts map differently', () => {
    const conflict = evaluateMergeChatwootCompatibility({
      survivorMapping: { chatwootContactId: 'cw_1', chatwootAccountId: 'acct' },
      duplicateMapping: { chatwootContactId: 'cw_2', chatwootAccountId: 'acct' },
    })
    expect(conflict?.kind).toBe('chatwoot')
  })

  it('successful merge without collisions and failed merge leaves proposal pending', async () => {
    let proposalStatus = 'PENDING'
    let duplicateStatus = 'ACTIVE'
    const mutations: string[] = []
    vi.doMock('@/lib/db', () => ({
      prisma: {
        $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
          try {
            return await fn({
              crmMergeProposal: {
                updateMany: async ({ data }: { data: { status: string } }) => {
                  if (proposalStatus !== 'PENDING') return { count: 0 }
                  proposalStatus = data.status
                  return { count: 1 }
                },
                findFirst: async () => ({
                  id: 'proposal_1',
                  customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
                  primaryContactId: 'primary',
                  duplicateContactId: 'duplicate',
                  confidenceBps: 9000,
                  status: proposalStatus,
                }),
                update: async ({ data }: { data: { status: string } }) => {
                  proposalStatus = data.status
                  return {}
                },
              },
              crmContact: {
                findFirst: async ({ where }: { where: { id: string } }) => ({
                  id: where.id,
                  customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
                  status: duplicateStatus,
                }),
                update: async () => {
                  duplicateStatus = 'MERGED'
                  mutations.push('duplicate-merged')
                  return {}
                },
              },
              contactConsent: { findMany: async () => [], update: async () => ({}) },
              contactSuppression: { findMany: async () => [], update: async () => ({}) },
              chatwootContactMapping: {
                findFirst: async ({ where }: { where: { crmContactId: string } }) =>
                  where.crmContactId === 'duplicate'
                    ? { id: 'map_dup', chatwootContactId: 'cw_dup', chatwootAccountId: 'acct' }
                    : { id: 'map_primary', chatwootContactId: 'cw_primary', chatwootAccountId: 'acct' },
              },
              chatwootConversationMapping: { updateMany: async () => ({ count: 0 }) },
              crmTimelineEvent: { updateMany: async () => ({ count: 0 }) },
              crmContactNote: { updateMany: async () => ({ count: 0 }) },
              crmTask: { updateMany: async () => ({ count: 0 }) },
              crmDeal: { updateMany: async () => ({ count: 0 }) },
              crmContactSource: { updateMany: async () => ({ count: 0 }) },
              crmContactChannelIdentity: { findMany: async () => [] },
              crmContactTag: { findMany: async () => [] },
              crmSegmentMember: { findMany: async () => [] },
              crmContactCompanyRelationship: { findMany: async () => [] },
              marketingLeadFollowUpEvaluation: { updateMany: async () => ({ count: 0 }) },
              marketingFollowUpTaskIntent: { findMany: async () => [] },
              crmContactMergeAudit: { create: async () => ({}) },
            })
          } catch (error) {
            proposalStatus = 'PENDING'
            duplicateStatus = 'ACTIVE'
            throw error
          }
        },
      },
    }))
    const { approveMergeProposal } = await import('@/lib/platform/crm/dedup-service')
    const failed = await approveMergeProposal({
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      proposalId: 'proposal_1',
      actorUserId: 'owner',
    })
    expect(failed.ok).toBe(false)
    expect(mutations).toHaveLength(0)
    expect(proposalStatus).toBe('PENDING')
    expect(duplicateStatus).toBe('ACTIVE')
  })

  it('transfers sole duplicate Chatwoot mapping to survivor when no collision exists', async () => {
    let transferred = false
    vi.doMock('@/lib/db', () => ({
      prisma: {
        $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
          fn({
            crmMergeProposal: {
              updateMany: async () => ({ count: 1 }),
              findFirst: async () => ({
                id: 'proposal_1',
                customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
                primaryContactId: 'primary',
                duplicateContactId: 'duplicate',
                confidenceBps: 9000,
              }),
              update: async () => ({}),
            },
            crmContact: {
              findFirst: async ({ where }: { where: { id: string } }) => ({
                id: where.id,
                customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
                status: 'ACTIVE',
              }),
              update: async () => ({}),
            },
            contactConsent: { findMany: async () => [] },
            contactSuppression: { findMany: async () => [] },
            chatwootContactMapping: {
              findFirst: async ({ where }: { where: { crmContactId: string } }) =>
                where.crmContactId === 'duplicate'
                  ? { id: 'map_dup', chatwootContactId: 'cw_dup', chatwootAccountId: 'acct' }
                  : null,
              update: async () => {
                transferred = true
                return {}
              },
            },
            chatwootConversationMapping: { updateMany: async () => ({ count: 1 }) },
            crmTimelineEvent: { updateMany: async () => ({ count: 0 }) },
            crmContactNote: { updateMany: async () => ({ count: 0 }) },
            crmTask: { updateMany: async () => ({ count: 0 }) },
            crmDeal: { updateMany: async () => ({ count: 0 }) },
            crmContactSource: { updateMany: async () => ({ count: 0 }) },
            crmContactChannelIdentity: { findMany: async () => [] },
            crmContactTag: { findMany: async () => [] },
            crmSegmentMember: { findMany: async () => [] },
            crmContactCompanyRelationship: { findMany: async () => [] },
            marketingLeadFollowUpEvaluation: { updateMany: async () => ({ count: 0 }) },
            marketingFollowUpTaskIntent: { findMany: async () => [] },
            crmContactMergeAudit: { create: async () => ({}) },
          }),
      },
    }))
    const { approveMergeProposal } = await import('@/lib/platform/crm/dedup-service')
    const approved = await approveMergeProposal({
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      proposalId: 'proposal_1',
      actorUserId: 'owner',
    })
    expect(approved.ok).toBe(true)
    expect(transferred).toBe(true)
  })
})

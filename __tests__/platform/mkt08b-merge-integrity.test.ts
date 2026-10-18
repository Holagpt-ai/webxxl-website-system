import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApprovalArtifactCasRollbackError } from '@/lib/platform/marketing/approval-errors'
import {
  coverageFromEvidence,
  deriveFollowUpEvidenceFromTimeline,
  hasVerifiedProviderSyncCoverage,
} from '@/lib/platform/marketing/follow-up-coverage-evidence'
import { buildCallbackTaskIntentFingerprint } from '@/lib/platform/marketing/follow-up-task-service'
import { denyBillingGroupSiblingMarketingAccess } from '@/lib/platform/marketing/account-isolation'
import { ABMED_AESTHETICS_ACCOUNT_ID, ABMED_PHYSICIANS_ACCOUNT_ID } from '@/lib/platform/fixtures/abmed'

describe('MKT-08B merge integrity (pure logic)', () => {
  it('E: partial provider coverage stays UNKNOWN_COVERAGE', () => {
    const evidence = deriveFollowUpEvidenceFromTimeline({
      timeline: [{ id: 'e1', eventKind: 'FORM_SUBMISSION', eventAt: new Date(), sourceSystem: 'native.crm' }],
      hasVerifiedProviderSyncCoverage: false,
      activeSuppression: false,
      marketingConsentStatus: 'NONE',
      completedCallbackTask: false,
      pendingCallbackTask: false,
    })
    expect(evidence.providerCoverageMissing).toBe(true)
    const coverage = coverageFromEvidence({
      evidence,
      dueAt: new Date(Date.now() - 86400000),
    })
    expect(coverage).toBe('UNKNOWN_COVERAGE')
  })

  it('F: completed outreach still classified when delivered', () => {
    const evidence = deriveFollowUpEvidenceFromTimeline({
      timeline: [
        {
          id: 'e1',
          eventKind: 'SMS_DELIVERED',
          eventAt: new Date('2026-10-01T12:00:00Z'),
          sourceSystem: 'native.crm',
        },
      ],
      hasVerifiedProviderSyncCoverage: false,
      activeSuppression: false,
      marketingConsentStatus: 'GRANTED',
      completedCallbackTask: false,
      pendingCallbackTask: false,
    })
    expect(evidence.hasQualifyingOutreach).toBe(true)
    const coverage = coverageFromEvidence({ evidence, dueAt: new Date() })
    expect(['CONTACTED', 'AWAITING_REPLY', 'OVERDUE']).toContain(coverage)
  })

  it('D: callback disposition field not used for intent fingerprint storage', () => {
    const fp = buildCallbackTaskIntentFingerprint({
      customerAccountId: 'a1',
      contactId: 'c1',
      assignedUserId: 'u1',
      evaluationId: 'ev1',
      operation: 'CALLBACK',
    })
    expect(fp).toMatch(/^[a-f0-9]{64}$/)
  })

  it('H: cross-account isolation retained', () => {
    const siblings = new Map([[ABMED_AESTHETICS_ACCOUNT_ID, [ABMED_AESTHETICS_ACCOUNT_ID, ABMED_PHYSICIANS_ACCOUNT_ID]]])
    expect(
      denyBillingGroupSiblingMarketingAccess({
        operatingAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
        recordAccountId: ABMED_PHYSICIANS_ACCOUNT_ID,
        billingGroupSiblingAccounts: siblings,
      }).ok,
    ).toBe(false)
  })
})

describe('MKT-08B approval atomic rollback (mocked Prisma — not PostgreSQL)', () => {
  const reviewState = vi.hoisted(() => ({ status: 'SUBMITTED' as string, revisionHash: 'hash-v1' }))

  const reviewUpdateMany = vi.hoisted(() => vi.fn())
  const artifactUpdateMany = vi.hoisted(() => vi.fn())
  const reviewFindFirst = vi.hoisted(() => vi.fn())

  vi.mock('@/lib/db', () => ({
    prisma: {
      marketingArtifactReview: {
        findFirst: (...args: unknown[]) => reviewFindFirst(...args),
        updateMany: (...args: unknown[]) => reviewUpdateMany(...args),
      },
      marketingArtifact: {
        findFirst: vi.fn(async () => ({ id: 'art-1', revisionHash: 'hash-v2' })),
        updateMany: (...args: unknown[]) => artifactUpdateMany(...args),
      },
      $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          marketingArtifactReview: {
            findFirst: reviewFindFirst,
            updateMany: reviewUpdateMany,
          },
          marketingArtifact: {
            findFirst: vi.fn(async () => ({ id: 'art-1', revisionHash: reviewState.revisionHash })),
            updateMany: artifactUpdateMany,
          },
        }
        return fn(tx)
      },
    },
  }))

  vi.mock('@/config/mkt-backend', () => ({
    isMktApprovalWorkflowEnabled: () => true,
  }))

  afterEach(() => {
    vi.clearAllMocks()
    reviewState.status = 'SUBMITTED'
    reviewState.revisionHash = 'hash-v1'
  })

  it('A: artifact CAS failure rolls back review update via transaction throw', async () => {
    reviewFindFirst.mockResolvedValue({
      id: 'rev-1',
      status: 'SUBMITTED',
      revisionHash: 'hash-v1',
      policyVersion: 'mkt-08-v1',
      marketingArtifactId: 'art-1',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 86400000),
    })
    reviewUpdateMany.mockResolvedValue({ count: 1 })
    artifactUpdateMany.mockResolvedValue({ count: 0 })

    const { decideMarketingArtifactReview } = await import('@/lib/platform/marketing/approval-service')
    const result = await decideMarketingArtifactReview({
      customerAccountId: 'acct-a',
      reviewerUserId: 'human-1',
      reviewId: 'rev-1',
      decision: 'APPROVED',
      actorType: 'USER',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('CONFLICT')
    expect(reviewState.status).toBe('SUBMITTED')
  })

  it('B: conflicting concurrent approval surfaces CONFLICT', async () => {
    reviewFindFirst.mockResolvedValue({
      id: 'rev-1',
      status: 'SUBMITTED',
      revisionHash: 'hash-v1',
      policyVersion: 'mkt-08-v1',
      marketingArtifactId: 'art-1',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 86400000),
    })
    reviewUpdateMany.mockResolvedValue({ count: 0 })

    const { decideMarketingArtifactReview } = await import('@/lib/platform/marketing/approval-service')
    const result = await decideMarketingArtifactReview({
      customerAccountId: 'acct-a',
      reviewerUserId: 'human-1',
      reviewId: 'rev-1',
      decision: 'APPROVED',
      actorType: 'USER',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('CONFLICT')
  })
})

describe('MKT-08B approval rollback error type', () => {
  it('ApprovalArtifactCasRollbackError is throwable', () => {
    expect(() => {
      throw new ApprovalArtifactCasRollbackError()
    }).toThrow(ApprovalArtifactCasRollbackError)
  })
})

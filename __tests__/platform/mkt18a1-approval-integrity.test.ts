import { afterEach, describe, expect, it, vi } from 'vitest'
import { reviewAllowedActions } from '@/lib/platform/marketing/review-presentation'
import {
  ApprovalSubmitDuplicatePendingError,
  ApprovalSubmitArtifactUpdateError,
} from '@/lib/platform/marketing/approval-errors'

describe('MKT-18A.1 review action honesty', () => {
  it('canDecide is false when approval workflow flag is off', () => {
    const actions = reviewAllowedActions({
      review: {
        status: 'SUBMITTED',
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: null,
        intendedAction: 'PUBLISH_SOCIAL',
      },
      viewerCanDecide: true,
      approvalWorkflowEnabled: false,
    })
    expect(actions.canDecide).toBe(false)
  })
})

describe('MKT-18A.1 submit review guards (mocked Prisma — not PostgreSQL)', () => {
  const artifactFindFirst = vi.hoisted(() => vi.fn())
  const revisionFindFirst = vi.hoisted(() => vi.fn())
  const reviewFindFirst = vi.hoisted(() => vi.fn())
  const reviewCreate = vi.hoisted(() => vi.fn())
  const artifactUpdateMany = vi.hoisted(() => vi.fn())
  const approvalEnabled = vi.hoisted(() => vi.fn(() => true))

  vi.mock('@/config/mkt-backend', () => ({
    isMktApprovalWorkflowEnabled: () => approvalEnabled(),
  }))

  vi.mock('@/lib/db', () => ({
    prisma: {
      marketingArtifact: { findFirst: (...args: unknown[]) => artifactFindFirst(...args) },
      marketingArtifactRevision: { findFirst: (...args: unknown[]) => revisionFindFirst(...args) },
      $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          marketingArtifact: {
            findFirst: artifactFindFirst,
            updateMany: (...args: unknown[]) => artifactUpdateMany(...args),
          },
          marketingArtifactRevision: { findFirst: revisionFindFirst },
          marketingArtifactReview: {
            findFirst: (...args: unknown[]) => reviewFindFirst(...args),
            create: (...args: unknown[]) => reviewCreate(...args),
          },
        }
        return fn(tx)
      },
    },
  }))

  const baseArtifact = {
    id: 'art-1',
    customerAccountId: 'acct-a',
    revisionHash: 'hash-v1',
    marketingRequestId: 'req-1',
    managedSiteId: null,
    reviewStatus: 'DRAFT',
  }

  afterEach(() => {
    vi.clearAllMocks()
    approvalEnabled.mockReturnValue(true)
  })

  it('returns NOT_CONFIGURED when approval workflow disabled', async () => {
    approvalEnabled.mockReturnValue(false)
    const { submitMarketingArtifactReview } = await import('@/lib/platform/marketing/approval-service')
    const result = await submitMarketingArtifactReview({
      customerAccountId: 'acct-a',
      userId: 'u1',
      artifactId: 'art-1',
      revisionHash: 'hash-v1',
      intendedAction: 'HANDOFF',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('NOT_CONFIGURED')
  })

  it('succeeds when artifact CAS opens submission and review is created', async () => {
    artifactFindFirst.mockResolvedValue({ ...baseArtifact })
    revisionFindFirst.mockResolvedValue({ id: 'rev-1' })
    artifactUpdateMany.mockResolvedValue({ count: 1 })
    reviewCreate.mockResolvedValue({ id: 'review-new' })

    const { submitMarketingArtifactReview } = await import('@/lib/platform/marketing/approval-service')
    const result = await submitMarketingArtifactReview({
      customerAccountId: 'acct-a',
      userId: 'u1',
      artifactId: 'art-1',
      revisionHash: 'hash-v1',
      intendedAction: 'HANDOFF',
    })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.reviewId).toBe('review-new')
    expect(reviewCreate).toHaveBeenCalledTimes(1)
  })

  it('returns CONFLICT on sequential duplicate when active pending review exists', async () => {
    artifactFindFirst.mockResolvedValue({ ...baseArtifact, reviewStatus: 'SUBMITTED' })
    revisionFindFirst.mockResolvedValue({ id: 'rev-1' })
    artifactUpdateMany.mockResolvedValue({ count: 0 })
    reviewFindFirst.mockResolvedValue({ id: 'review-existing' })

    const { submitMarketingArtifactReview } = await import('@/lib/platform/marketing/approval-service')
    const result = await submitMarketingArtifactReview({
      customerAccountId: 'acct-a',
      userId: 'u1',
      artifactId: 'art-1',
      revisionHash: 'hash-v1',
      intendedAction: 'HANDOFF',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('CONFLICT')
    expect(reviewCreate).not.toHaveBeenCalled()
  })

  it('returns CONFLICT for competing concurrent submission (artifact already SUBMITTED, no row yet)', async () => {
    artifactFindFirst
      .mockResolvedValueOnce({ ...baseArtifact })
      .mockResolvedValue({ ...baseArtifact, reviewStatus: 'SUBMITTED' })
    revisionFindFirst.mockResolvedValue({ id: 'rev-1' })
    artifactUpdateMany.mockResolvedValue({ count: 0 })
    reviewFindFirst.mockResolvedValue(null)

    const { submitMarketingArtifactReview } = await import('@/lib/platform/marketing/approval-service')
    const result = await submitMarketingArtifactReview({
      customerAccountId: 'acct-a',
      userId: 'u1',
      artifactId: 'art-1',
      revisionHash: 'hash-v1',
      intendedAction: 'HANDOFF',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('CONFLICT')
    expect(reviewCreate).not.toHaveBeenCalled()
  })

  it('returns CONFLICT when revision hash mismatches inside transaction', async () => {
    artifactFindFirst
      .mockResolvedValueOnce({ ...baseArtifact })
      .mockResolvedValue({ ...baseArtifact, revisionHash: 'hash-v2' })
    revisionFindFirst.mockResolvedValue({ id: 'rev-1' })
    artifactUpdateMany.mockResolvedValue({ count: 0 })
    reviewFindFirst.mockResolvedValue(null)

    const { submitMarketingArtifactReview } = await import('@/lib/platform/marketing/approval-service')
    const result = await submitMarketingArtifactReview({
      customerAccountId: 'acct-a',
      userId: 'u1',
      artifactId: 'art-1',
      revisionHash: 'hash-v1',
      intendedAction: 'HANDOFF',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('CONFLICT')
  })

  it('rolls back when review create fails after artifact CAS (mocked Prisma)', async () => {
    artifactFindFirst.mockResolvedValue({ ...baseArtifact })
    revisionFindFirst.mockResolvedValue({ id: 'rev-1' })
    artifactUpdateMany.mockResolvedValue({ count: 1 })
    reviewCreate.mockRejectedValue(new Error('insert failed'))

    const { submitMarketingArtifactReview } = await import('@/lib/platform/marketing/approval-service')
    await expect(
      submitMarketingArtifactReview({
        customerAccountId: 'acct-a',
        userId: 'u1',
        artifactId: 'art-1',
        revisionHash: 'hash-v1',
        intendedAction: 'HANDOFF',
      }),
    ).rejects.toThrow('insert failed')
  })
})

describe('MKT-18A.1 approval error types', () => {
  it('duplicate pending error is throwable', () => {
    expect(() => {
      throw new ApprovalSubmitDuplicatePendingError()
    }).toThrow(ApprovalSubmitDuplicatePendingError)
  })

  it('artifact update error is throwable', () => {
    expect(() => {
      throw new ApprovalSubmitArtifactUpdateError()
    }).toThrow(ApprovalSubmitArtifactUpdateError)
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'
import { decodeMktListCursor, encodeMktListCursor } from '@/lib/platform/marketing/mkt-list-cursor'
import {
  computeReviewEffectiveStatus,
  isActiveSubmittedReview,
  reviewAllowedActions,
} from '@/lib/platform/marketing/review-presentation'
import { hasMarketingPermission } from '@/lib/platform/marketing/permissions'
import { ApprovalSubmitArtifactUpdateError } from '@/lib/platform/marketing/approval-errors'

describe('MKT-18A list cursor', () => {
  it('round-trips createdAt/id cursor', () => {
    const encoded = encodeMktListCursor({ c: '2026-10-29T12:00:00.000Z', i: 'art_1' })
    const decoded = decodeMktListCursor(encoded)
    expect(decoded.ok).toBe(true)
    if (decoded.ok) expect(decoded.value).toEqual({ c: '2026-10-29T12:00:00.000Z', i: 'art_1' })
  })

  it('rejects malformed cursor', () => {
    const decoded = decodeMktListCursor('not-a-cursor')
    expect(decoded.ok).toBe(false)
    if (!decoded.ok) expect(decoded.code).toBe('VALIDATION')
  })
})

describe('MKT-18A review presentation', () => {
  it('marks SUBMITTED past expiresAt as EXPIRED', () => {
    const status = computeReviewEffectiveStatus({
      status: 'SUBMITTED',
      expiresAt: new Date(Date.now() - 1000),
      revokedAt: null,
    })
    expect(status).toBe('EXPIRED')
    expect(isActiveSubmittedReview({ status: 'SUBMITTED', expiresAt: new Date(Date.now() - 1000), revokedAt: null })).toBe(
      false,
    )
  })

  it('does not treat APPROVED artifact reviewStatus alone as pending', () => {
    expect(
      isActiveSubmittedReview({ status: 'APPROVED', expiresAt: new Date(Date.now() + 86400000), revokedAt: null }),
    ).toBe(false)
  })

  it('allows decide only for active SUBMITTED when viewer can review', () => {
    const actions = reviewAllowedActions({
      review: {
        status: 'SUBMITTED',
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: null,
        intendedAction: 'PUBLISH_SOCIAL',
        allowedChannel: 'instagram',
      },
      viewerCanDecide: true,
    })
    expect(actions.canDecide).toBe(true)
    expect(actions.intendedAction).toBe('PUBLISH_SOCIAL')
  })

  it('MEMBER cannot decide approvals', () => {
    expect(
      hasMarketingPermission({ membershipRole: 'MEMBER', isStaff: false }, 'marketing.artifact.review'),
    ).toBe(false)
    expect(
      hasMarketingPermission({ membershipRole: 'OWNER', isStaff: false }, 'marketing.artifact.review'),
    ).toBe(true)
  })
})

describe('MKT-18A submit review atomicity (mocked Prisma)', () => {
  const artifactFindFirst = vi.hoisted(() => vi.fn())
  const revisionFindFirst = vi.hoisted(() => vi.fn())
  const reviewCreate = vi.hoisted(() => vi.fn())
  const artifactUpdateMany = vi.hoisted(() => vi.fn())

  vi.mock('@/config/mkt-backend', () => ({
    isMktApprovalWorkflowEnabled: () => true,
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
          marketingArtifactReview: { create: (...args: unknown[]) => reviewCreate(...args) },
        }
        return fn(tx)
      },
    },
  }))

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('rolls back when artifact status update fails after review create', async () => {
    artifactFindFirst.mockResolvedValue({
      id: 'art-1',
      customerAccountId: 'acct-a',
      revisionHash: 'hash-v1',
      marketingRequestId: 'req-1',
      managedSiteId: null,
    })
    revisionFindFirst.mockResolvedValue({ id: 'rev-row-1' })
    reviewCreate.mockResolvedValue({ id: 'review-1' })
    artifactUpdateMany.mockResolvedValue({ count: 0 })

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
    expect(reviewCreate).toHaveBeenCalledTimes(1)
  })
})

describe('MKT-18A submit rollback error type', () => {
  it('ApprovalSubmitArtifactUpdateError is throwable', () => {
    expect(() => {
      throw new ApprovalSubmitArtifactUpdateError()
    }).toThrow(ApprovalSubmitArtifactUpdateError)
  })
})

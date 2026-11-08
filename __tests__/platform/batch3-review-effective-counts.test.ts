import { describe, expect, it } from 'vitest'
import type { MarketingArtifactReviewStatus } from '@prisma/client'
import {
  computeReviewEffectiveStatus,
  type ReviewEffectiveStatus,
} from '@/lib/platform/marketing/review-presentation'
import { reviewEffectiveStatusWhere } from '@/lib/platform/marketing-execution/review-effective-counts'
import { PREPARATION_ONLY_DISPATCH_BLOCKED_CODE } from '@/lib/platform/marketing-execution/constants'
import { mapPostizReadinessForExecutionSummary } from '@/lib/platform/marketing-execution/postiz-readiness-summary'

type SampleRow = {
  status: MarketingArtifactReviewStatus
  revokedAt: Date | null
  expiresAt: Date | null
}

function bucketForRow(row: SampleRow, now: Date): ReviewEffectiveStatus {
  return computeReviewEffectiveStatus(row, now)
}

describe('Batch 3 review effective count predicates', () => {
  const now = new Date('2026-11-08T12:00:00.000Z')

  it('requires revocation precedence in APPROVED and REVOKED where clauses', () => {
    const approvedWhere = reviewEffectiveStatusWhere('APPROVED', { customerAccountId: 'a' }, now)
    const revokedWhere = reviewEffectiveStatusWhere('REVOKED', { customerAccountId: 'a' }, now)
    expect(JSON.stringify(approvedWhere)).toContain('"revokedAt":null')
    expect(JSON.stringify(revokedWhere)).toMatch(/revokedAt/)
  })

  it('maps representative rows to a single effective status (mutual exclusivity target)', () => {
    const rows: SampleRow[] = [
      { status: 'APPROVED', revokedAt: new Date('2026-01-01'), expiresAt: null },
      { status: 'APPROVED', revokedAt: null, expiresAt: null },
      { status: 'SUBMITTED', revokedAt: null, expiresAt: new Date('2020-01-01') },
      { status: 'SUBMITTED', revokedAt: null, expiresAt: new Date('2099-01-01') },
      { status: 'REJECTED', revokedAt: null, expiresAt: null },
      { status: 'DRAFT', revokedAt: null, expiresAt: null },
      { status: 'EXPIRED', revokedAt: null, expiresAt: null },
      { status: 'REVOKED', revokedAt: null, expiresAt: null },
    ]
    expect(bucketForRow(rows[0]!, now)).toBe('REVOKED')
    expect(bucketForRow(rows[1]!, now)).toBe('APPROVED')
    expect(bucketForRow(rows[2]!, now)).toBe('EXPIRED')
    expect(bucketForRow(rows[3]!, now)).toBe('SUBMITTED')
    expect(bucketForRow(rows[4]!, now)).toBe('REJECTED')
    expect(bucketForRow(rows[5]!, now)).toBe('DRAFT')
    expect(bucketForRow(rows[6]!, now)).toBe('EXPIRED')
    expect(bucketForRow(rows[7]!, now)).toBe('REVOKED')
  })
})

describe('Batch 3 Postiz readiness summary normalization', () => {
  it('always reports preparation-only dispatch blocking with truthful flags', () => {
    const mapped = mapPostizReadinessForExecutionSummary({
      customerAccountId: 'acct_a',
      assessedAt: '2026-11-08T00:00:00.000Z',
      moduleEnabled: true,
      postizApiEnabled: true,
      livePublishingEnabled: true,
      credentialsConfigured: true,
      workspaceConnected: true,
      channels: [
        {
          connectionId: 'ch_1',
          platform: 'linkedin',
          displayName: 'Co',
          connectionState: 'CONNECTED',
          externalChannelRef: 'ref',
          dispatchAllowed: true,
        },
      ],
      dispatchBlockedCode: 'LIVE_DISPATCH_AUTHORIZED_AT_FLAG',
      dispatchBlockedMessage: 'would authorize elsewhere',
    })
    expect(mapped.dispatchBlockedCode).toBe(PREPARATION_ONLY_DISPATCH_BLOCKED_CODE)
    expect(mapped.livePublishingEnabled).toBe(true)
    expect(mapped.postizApiEnabled).toBe(true)
    expect(mapped.dispatchBlockedMessage).toContain('POSTIZ_LIVE_PUBLISHING_ENABLED=true')
    expect(mapped.channels[0]?.dispatchAllowed).toBe(false)
  })
})

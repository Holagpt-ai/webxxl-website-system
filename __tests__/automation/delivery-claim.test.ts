import { beforeEach, describe, expect, it, vi } from 'vitest'

const { findUnique, updateMany, findMany } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  updateMany: vi.fn(),
  findMany: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    automationDeliveryJob: { findUnique, updateMany, findMany },
  },
}))

import {
  claimableNotificationLastErrorFilter,
  commitAutomationDeliveryJobClaim,
  recoverExpiredAutomationDeliveryClaims,
  tryClaimAutomationDeliveryJob,
} from '@/lib/automation/delivery-claim'
import { DELIVERY_OUTCOME_UNKNOWN_EXTERNAL } from '@/lib/automation/delivery-outcome'

describe('automation delivery claim (AUTO-10)', () => {
  beforeEach(() => {
    findUnique.mockReset()
    updateMany.mockReset()
  })

  it('8: NULL lastErrorClass job can claim', async () => {
    const now = new Date('2026-01-01T12:00:00Z')
    findUnique.mockResolvedValueOnce({
      id: 'job-null',
      claimFence: 0,
      status: 'PENDING',
      lastErrorClass: null,
    })
    updateMany.mockResolvedValueOnce({ count: 1 })
    const claim = await tryClaimAutomationDeliveryJob({
      jobId: 'job-null',
      workerId: 'w-a',
      now,
    })
    expect(claim.claimed).toBe(true)
    expect(updateMany.mock.calls[0][0].where.AND).toEqual(
      expect.arrayContaining([claimableNotificationLastErrorFilter()]),
    )
  })

  it('9: quarantined job cannot claim', async () => {
    findUnique.mockResolvedValueOnce({
      id: 'job-q',
      claimFence: 1,
      lastErrorClass: DELIVERY_OUTCOME_UNKNOWN_EXTERNAL,
    })
    const claim = await tryClaimAutomationDeliveryJob({
      jobId: 'job-q',
      workerId: 'w-a',
    })
    expect(claim.claimed).toBe(false)
    expect(updateMany).not.toHaveBeenCalled()
  })

  it('M: conditional claim succeeds only when status and lease allow', async () => {
    const now = new Date('2026-01-01T12:00:00Z')
    findUnique.mockResolvedValueOnce({
      id: 'job-1',
      claimFence: 2,
      status: 'PENDING',
      lastErrorClass: null,
    })
    updateMany.mockResolvedValueOnce({ count: 1 })

    const claim = await tryClaimAutomationDeliveryJob({
      jobId: 'job-1',
      workerId: 'w-a',
      now,
    })

    expect(claim.claimed).toBe(true)
    expect(claim.fence).toBe(3)
    expect(claim.claimToken).toBeTruthy()
    const call = updateMany.mock.calls[0][0]
    expect(call.where.id).toBe('job-1')
    expect(call.where.AND).toEqual(
      expect.arrayContaining([claimableNotificationLastErrorFilter()]),
    )
    expect(call.data.status).toBe('PROCESSING')
    expect(call.data.claimFence).toBe(3)
  })

  it('M: expired PROCESSING claim recovery fences and reschedules', async () => {
    const now = new Date('2026-01-01T12:00:00Z')
    findMany.mockResolvedValueOnce([
      {
        id: 'job-1',
        attempts: 1,
        claimFence: 4,
        lastErrorClass: null,
        channel: 'IN_APP',
        providerRef: null,
      },
    ])
    updateMany.mockResolvedValueOnce({ count: 1 })
    const n = await recoverExpiredAutomationDeliveryClaims(now)
    expect(n).toBe(1)
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ claimFence: 4, claimExpiresAt: { lt: now } }),
        data: expect.objectContaining({ claimFence: 5, status: 'FAILED' }),
      }),
    )
  })

  it('N: fenced commit rejects stale worker token', async () => {
    updateMany.mockResolvedValueOnce({ count: 0 })
    const ok = await commitAutomationDeliveryJobClaim({
      jobId: 'job-1',
      claimToken: 'stale',
      claimFence: 1,
      data: { status: 'DELIVERED', deliveredAt: new Date() },
    })
    expect(ok).toBe(false)
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'PROCESSING',
          claimToken: 'stale',
          claimFence: 1,
        }),
      }),
    )
  })
})

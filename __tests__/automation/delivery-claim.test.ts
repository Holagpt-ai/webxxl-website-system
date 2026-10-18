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
  commitAutomationDeliveryJobClaim,
  recoverExpiredAutomationDeliveryClaims,
  tryClaimAutomationDeliveryJob,
} from '@/lib/automation/delivery-claim'

describe('automation delivery claim (AUTO-10)', () => {
  beforeEach(() => {
    findUnique.mockReset()
    updateMany.mockReset()
  })

  it('M: conditional claim succeeds only when status and lease allow', async () => {
    const now = new Date('2026-01-01T12:00:00Z')
    findUnique.mockResolvedValueOnce({
      id: 'job-1',
      claimFence: 2,
      status: 'PENDING',
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
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'job-1',
          OR: [{ claimExpiresAt: null }, { claimExpiresAt: { lt: now } }],
        }),
        data: expect.objectContaining({ status: 'PROCESSING', claimFence: 3 }),
      }),
    )
  })

  it('M: expired PROCESSING claim recovery fences and reschedules', async () => {
    const now = new Date('2026-01-01T12:00:00Z')
    findMany.mockResolvedValueOnce([
      {
        id: 'job-1',
        attempts: 1,
        claimFence: 4,
        lastErrorClass: null,
      },
    ])
    updateMany.mockResolvedValueOnce({ count: 1 })
    const n = await recoverExpiredAutomationDeliveryClaims(now)
    expect(n).toBe(1)
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ claimFence: 4, claimExpiresAt: { lt: now } }),
        data: expect.objectContaining({ claimFence: 5 }),
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

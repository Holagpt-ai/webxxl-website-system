import { beforeEach, describe, expect, it, vi } from 'vitest'
import { parseHostingServiceStatus } from '@/lib/infrastructure/lifecycle-enums'

const hoisted = vi.hoisted(() => ({
  hostingFindUnique: vi.fn(),
  hostingUpdate: vi.fn(),
  domainFindUnique: vi.fn(),
  domainUpdate: vi.fn(),
  emailFindUnique: vi.fn(),
  emailUpdate: vi.fn(),
  activityCreate: vi.fn(),
  transaction: vi.fn(),
  revalidatePath: vi.fn(),
  requireStaff: vi.fn(async () => ({ id: 'staff-42' })),
}))

vi.mock('next/cache', () => ({ revalidatePath: hoisted.revalidatePath }))

vi.mock('@/lib/portal/authz', () => ({
  requireStaff: hoisted.requireStaff,
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    hostingService: {
      findUnique: hoisted.hostingFindUnique,
      update: hoisted.hostingUpdate,
    },
    managedDomain: {
      findUnique: hoisted.domainFindUnique,
      update: hoisted.domainUpdate,
    },
    businessEmailService: {
      findUnique: hoisted.emailFindUnique,
      update: hoisted.emailUpdate,
    },
    infrastructureActivity: { create: hoisted.activityCreate },
    $transaction: hoisted.transaction,
  },
}))

import { applyHostingLifecycleStatus } from '@/lib/infrastructure/lifecycle-mutations'
import { adminUpdateHostingLifecycleAction } from '@/lib/infrastructure/admin-actions'

describe('infrastructure lifecycle enums', () => {
  it('rejects invalid hosting statuses', () => {
    expect(parseHostingServiceStatus('ACTIVE')).toBe('ACTIVE')
    expect(parseHostingServiceStatus('NOT_ALLOWED')).toBeNull()
  })
})

describe('applyHostingLifecycleStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    hoisted.hostingFindUnique.mockResolvedValue({ id: 'h1', customerAccountId: 'ca1' })
    hoisted.hostingUpdate.mockResolvedValue({ id: 'h1' })
    hoisted.activityCreate.mockResolvedValue({ id: 'act-1' })
    hoisted.transaction.mockImplementation(async (ops: unknown[]) => {
      for (const op of ops as Promise<unknown>[]) {
        await op
      }
    })
  })

  it('records attributable activity on success', async () => {
    const result = await applyHostingLifecycleStatus({
      hostingId: 'h1',
      status: 'SUSPENDED',
      actorUserId: 'staff-42',
    })
    expect(result.ok).toBe(true)
    expect(hoisted.transaction).toHaveBeenCalledTimes(1)
    expect(hoisted.activityCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          assetType: 'HOSTING',
          assetId: 'h1',
          actorUserId: 'staff-42',
          customerAccountId: 'ca1',
          summary: expect.stringContaining('SUSPENDED'),
        }),
      }),
    )
  })

  it('rolls back when audit insert fails', async () => {
    hoisted.activityCreate.mockRejectedValueOnce(new Error('audit failed'))
    const result = await applyHostingLifecycleStatus({
      hostingId: 'h1',
      status: 'ACTIVE',
      actorUserId: 'staff-42',
    })
    expect(result).toEqual({ ok: false, error: 'transaction_failed' })
    expect(hoisted.hostingUpdate).toHaveBeenCalled()
  })
})

describe('adminUpdateHostingLifecycleAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    hoisted.revalidatePath.mockClear()
    hoisted.hostingFindUnique.mockResolvedValue({ id: 'h1', customerAccountId: 'ca1' })
    hoisted.hostingUpdate.mockResolvedValue({ id: 'h1' })
    hoisted.activityCreate.mockResolvedValue({ id: 'a1' })
    hoisted.transaction.mockImplementation(async (ops: unknown[]) => {
      for (const op of ops as Promise<unknown>[]) {
        await op
      }
    })
  })

  it('rejects invalid lifecycle status without mutating', async () => {
    const fd = new FormData()
    fd.set('hostingId', 'h1')
    fd.set('status', 'LIVE_IN_PRODUCTION')
    const result = await adminUpdateHostingLifecycleAction(fd)
    expect(result).toEqual({ ok: false, error: 'invalid_status' })
    expect(hoisted.transaction).not.toHaveBeenCalled()
    expect(hoisted.revalidatePath).not.toHaveBeenCalled()
  })

  it('does not revalidate on transaction failure', async () => {
    hoisted.activityCreate.mockRejectedValueOnce(new Error('audit failed'))
    hoisted.transaction.mockImplementation(async (ops: unknown[]) => {
      for (const op of ops as Promise<unknown>[]) {
        await op
      }
    })
    const fd = new FormData()
    fd.set('hostingId', 'h1')
    fd.set('status', 'PENDING')
    const result = await adminUpdateHostingLifecycleAction(fd)
    expect(result.ok).toBe(false)
    expect(hoisted.revalidatePath).not.toHaveBeenCalled()
  })

  it('revalidates only after successful save', async () => {
    const fd = new FormData()
    fd.set('hostingId', 'h1')
    fd.set('status', 'ACTIVE')
    const result = await adminUpdateHostingLifecycleAction(fd)
    expect(result).toEqual({ ok: true })
    expect(hoisted.revalidatePath).toHaveBeenCalled()
  })
})
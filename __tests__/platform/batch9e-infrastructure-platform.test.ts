import { describe, expect, it, vi, beforeEach } from 'vitest'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { formatNameservers } from '@/lib/infrastructure/display'
import { isInfrastructureRequestType } from '@/lib/infrastructure/requests'

const hoisted = vi.hoisted(() => ({
  findUnique: vi.fn(),
  transaction: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    supportRequest: {
      findUnique: hoisted.findUnique,
      update: hoisted.update,
    },
    supportRequestMessage: { create: hoisted.create },
    $transaction: hoisted.transaction,
  },
}))

vi.mock('@/lib/portal/authz', () => ({
  requireStaff: vi.fn(async () => ({ id: 'staff-1' })),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { addStaffSupportReply } from '@/lib/portal/support-messages'

describe('Batch 9E infrastructure platform', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('includes infrastructure completion copy in EN/ES', () => {
    expect(getDictionary('en').dashboard.infrastructureActivityTitle).toBeTruthy()
    expect(getDictionary('es').dashboard.infrastructureDnsProvider).toBeTruthy()
    expect(getDictionary('en').admin.support.staffReplySubmit).toBeTruthy()
  })

  it('formats nameservers for customer display', () => {
    expect(formatNameservers(['ns1.example.com', 'ns2.example.com'])).toBe('ns1.example.com, ns2.example.com')
    expect(formatNameservers(null)).toBeNull()
  })

  it('persists staff support replies for open tickets', async () => {
    hoisted.findUnique.mockResolvedValue({
      id: 't1',
      status: 'IN_PROGRESS',
      customerAccountId: 'ca1',
      projectId: null,
    })
    hoisted.transaction.mockImplementation(async (ops: unknown[]) => {
      await Promise.all(ops as Promise<unknown>[])
    })
    hoisted.create.mockResolvedValue({ id: 'm1' })
    hoisted.update.mockResolvedValue({ id: 't1' })

    const result = await addStaffSupportReply({
      supportRequestId: 't1',
      authorUserId: 'staff-1',
      body: 'We received your DNS request — no changes applied yet.',
    })
    expect(result.ok).toBe(true)
    expect(hoisted.transaction).toHaveBeenCalled()
  })

  it('rejects invalid infrastructure request types', () => {
    expect(isInfrastructureRequestType('dns_modification')).toBe(true)
    expect(isInfrastructureRequestType('live_dns_apply')).toBe(false)
  })
})
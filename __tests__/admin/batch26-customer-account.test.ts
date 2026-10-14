import { beforeEach, describe, expect, it, vi } from 'vitest'

const hoisted = vi.hoisted(() => ({
  findUnique: vi.fn(),
  create: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    customerAccount: {
      findUnique: hoisted.findUnique,
      create: hoisted.create,
    },
  },
}))

import { createCustomerAccountRecord } from '@/lib/admin/customer-onboarding'

describe('createCustomerAccountRecord', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns duplicate_slug when an explicit slug is taken', async () => {
    hoisted.findUnique.mockResolvedValueOnce({ id: 'existing' })
    const result = await createCustomerAccountRecord({
      businessName: 'Acme',
      slug: 'acme',
    })
    expect(result).toEqual({ ok: false, error: 'duplicate_slug' })
    expect(hoisted.create).not.toHaveBeenCalled()
  })

  it('creates an onboarding account with generated slug', async () => {
    hoisted.findUnique.mockResolvedValueOnce(null)
    hoisted.create.mockResolvedValueOnce({
      id: 'acct-1',
      slug: 'acme-plumbing',
    })
    const result = await createCustomerAccountRecord({ businessName: 'Acme Plumbing' })
    expect(result).toMatchObject({ ok: true, customerAccountId: 'acct-1', slug: 'acme-plumbing' })
    expect(hoisted.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'ONBOARDING', businessName: 'Acme Plumbing' }),
      }),
    )
  })
})

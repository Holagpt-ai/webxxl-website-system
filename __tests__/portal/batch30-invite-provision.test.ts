import { beforeEach, describe, expect, it, vi } from 'vitest'

const hoisted = vi.hoisted(() => ({
  sendInvite: vi.fn(),
  membershipUpdate: vi.fn(async () => ({})),
  membershipUpsert: vi.fn(async () => ({})),
  userFindUnique: vi.fn(async () => null),
  userCreate: vi.fn(async () => ({ id: 'u1', role: 'CUSTOMER', email: 'a@b.com' })),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    user: { findUnique: hoisted.userFindUnique, create: hoisted.userCreate },
    customerMembership: {
      findUnique: vi.fn(async () => null),
      upsert: hoisted.membershipUpsert,
      update: hoisted.membershipUpdate,
    },
  },
}))

vi.mock('@/lib/portal/customer-invite-mail', () => ({
  sendCustomerInvitationMagicLink: hoisted.sendInvite,
}))

import { provisionCustomerInvite } from '@/lib/portal/customer-invite-provision'

describe('batch30 customer invite provision', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    hoisted.sendInvite.mockResolvedValue({ ok: true })
  })

  it('sets lastInviteSentAt only after successful delivery', async () => {
    const result = await provisionCustomerInvite({
      customerAccountId: 'acct-1',
      email: 'owner@example.com',
      role: 'OWNER',
      locale: 'en',
      sendEmail: true,
    })
    expect(result).toEqual({ ok: true, inviteSent: true })
    expect(hoisted.membershipUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ lastInviteSentAt: expect.any(Date) }),
      }),
    )
  })

  it('keeps lastInviteSentAt unset when delivery fails', async () => {
    hoisted.sendInvite.mockResolvedValueOnce({ ok: false, error: 'auth_email_not_configured' })
    const result = await provisionCustomerInvite({
      customerAccountId: 'acct-1',
      email: 'owner@example.com',
      role: 'OWNER',
      locale: 'en',
      sendEmail: true,
    })
    expect(result).toMatchObject({ ok: true, inviteSent: false, inviteError: 'auth_email_not_configured' })
    expect(hoisted.membershipUpdate).not.toHaveBeenCalled()
  })
})

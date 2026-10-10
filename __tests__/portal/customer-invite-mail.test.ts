import { beforeEach, describe, expect, it, vi } from 'vitest'

const signIn = vi.hoisted(() => vi.fn())

vi.mock('@/auth', () => ({ signIn }))
vi.mock('@/lib/integrations/email', () => ({ isAuthEmailConfigured: () => true }))

import { sendCustomerInvitationMagicLink } from '@/lib/portal/customer-invite-mail'

describe('customer invitation magic link', () => {
  beforeEach(() => {
    signIn.mockReset()
    signIn.mockResolvedValue(undefined)
  })

  it('requests Auth.js email sign-in with account activation redirect', async () => {
    const result = await sendCustomerInvitationMagicLink('invited@example.com', 'acct-target', 'es')
    expect(result).toEqual({ ok: true })
    expect(signIn).toHaveBeenCalledWith('email', {
      email: 'invited@example.com',
      redirect: false,
      redirectTo: '/api/portal/activate-account?accountId=acct-target&locale=es',
    })
  })
})

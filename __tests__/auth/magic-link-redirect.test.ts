import { beforeEach, describe, expect, it, vi } from 'vitest'

const signIn = vi.hoisted(() => vi.fn())
const findUnique = vi.hoisted(() => vi.fn())

vi.mock('@/auth', () => ({
  signIn,
  signOut: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    user: { findUnique },
  },
}))

vi.mock('@/lib/integrations/email', () => ({
  isAuthEmailConfigured: () => true,
}))

import { requestMagicLinkAction } from '@/app/[locale]/login/actions'
import { magicLinkRedirectForLocale, resolveMagicLinkRedirect } from '@/lib/portal/auth-redirect'

const invitedCustomer = { role: 'CUSTOMER', memberships: [{ id: 'membership_1' }] }

describe('magic link redirect targets', () => {
  beforeEach(() => {
    signIn.mockReset()
    signIn.mockResolvedValue('/login?checkEmail=1')
    findUnique.mockReset()
    findUnique.mockResolvedValue(invitedCustomer)
  })

  it('sends English callbacks to /dashboard', async () => {
    expect(magicLinkRedirectForLocale('en')).toBe('/dashboard')
    expect(resolveMagicLinkRedirect('/dashboard')).toBe('/dashboard')

    const result = await requestMagicLinkAction('  Carlos@Example.com ', '/dashboard')

    expect(result).toEqual({ ok: true })
    expect(signIn).toHaveBeenCalledWith('email', {
      email: 'carlos@example.com',
      redirect: false,
      redirectTo: '/dashboard',
    })
  })

  it('sends Spanish callbacks to /es/dashboard', async () => {
    expect(magicLinkRedirectForLocale('es')).toBe('/es/dashboard')
    expect(resolveMagicLinkRedirect('/es/dashboard')).toBe('/es/dashboard')

    const result = await requestMagicLinkAction('carlos@example.com', '/es/dashboard')

    expect(result).toEqual({ ok: true })
    expect(signIn).toHaveBeenCalledWith('email', {
      email: 'carlos@example.com',
      redirect: false,
      redirectTo: '/es/dashboard',
    })
  })

  it('keeps an uninvited email non-enumerating', async () => {
    findUnique.mockResolvedValueOnce(null)
    const missing = await requestMagicLinkAction('unknown@example.com', '/dashboard')

    findUnique.mockResolvedValueOnce({ role: 'CUSTOMER', memberships: [] })
    const uninvitedCustomer = await requestMagicLinkAction('pending@example.com', '/es/dashboard')

    const invited = await requestMagicLinkAction('carlos@example.com', '/dashboard')

    expect(missing).toEqual({ ok: true })
    expect(uninvitedCustomer).toEqual({ ok: true })
    expect(missing).toEqual(invited)
    expect(uninvitedCustomer).not.toHaveProperty('reason')
    expect(signIn).toHaveBeenCalledTimes(1)
    expect(signIn).toHaveBeenCalledWith('email', {
      email: 'carlos@example.com',
      redirect: false,
      redirectTo: '/dashboard',
    })
  })
})

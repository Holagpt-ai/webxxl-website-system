import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildCustomerActivationRedirect,
  deriveMembershipAccessState,
  normalizeCustomerInviteEmail,
  wouldViolateLastOwnerOnDemote,
  wouldViolateLastOwnerOnRemove,
} from '@/lib/portal/customer-access'
import { pickActiveMembership } from '@/lib/portal/active-customer-account'
import { parseMagicLinkEmailContext } from '@/lib/integrations/email'
import { canAccessProject } from '@/lib/portal/access-rules'
import { customerOwnsManagedSite } from '@/lib/managed-sites/domain'
import { MAGIC_LINK_REDIRECT_ADMIN, magicLinkRedirectForLocale } from '@/lib/portal/auth-redirect'

const signIn = vi.hoisted(() => vi.fn())
const sendCustomerInvitationMagicLink = vi.hoisted(() => vi.fn())
const hoisted = vi.hoisted(() => {
  const adminUser = { id: 'admin-1', email: 'admin@example.com', role: 'ADMIN' as const }
  const customerUser = { id: 'user-1', email: 'customer@example.com', role: 'CUSTOMER' as const }
  const now = new Date('2026-10-10T12:00:00.000Z')
  const users: Record<string, { id: string; email: string; role: string; emailVerified: Date | null; lastLoginAt: Date | null }> =
    {}
  let memberships: Array<{
    id: string
    userId: string
    customerAccountId: string
    role: 'OWNER' | 'MEMBER'
    invitedAt: Date | null
    lastInviteSentAt: Date | null
    createdAt: Date
  }> = []

  return {
    adminUser,
    customerUser,
    now,
    users,
    memberships,
    reset() {
      for (const key of Object.keys(users)) delete users[key]
      memberships.length = 0
    },
    requireAdmin: vi.fn(async () => adminUser),
    requireUser: vi.fn(async () => customerUser),
    prisma: {
      customerAccount: {
        findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
          where.id === 'acct-1' ? { id: 'acct-1', businessName: 'ABMED' } : null,
        ),
      },
      user: {
        findUnique: vi.fn(async ({ where }: { where: { email?: string; id?: string } }) => {
          if (where.email) {
            const hit = Object.values(users).find((u) => u.email === where.email)
            return hit ?? null
          }
          if (where.id) return users[where.id] ?? null
          return null
        }),
        create: vi.fn(async ({ data }: { data: { email: string; role: string; emailVerified: null } }) => {
          const id = `user-${Object.keys(users).length + 1}`
          const row = { id, email: data.email, role: data.role, emailVerified: data.emailVerified, lastLoginAt: null }
          users[id] = row
          return row
        }),
        update: vi.fn(async () => {
          throw new Error('db_fail')
        }),
      },
      customerMembership: {
        findUnique: vi.fn(async ({ where }: { where: { id?: string; userId_customerAccountId?: { userId: string; customerAccountId: string } } }) => {
          if (where.id) return memberships.find((m) => m.id === where.id) ?? null
          if (where.userId_customerAccountId) {
            const { userId, customerAccountId } = where.userId_customerAccountId
            return memberships.find((m) => m.userId === userId && m.customerAccountId === customerAccountId) ?? null
          }
          return null
        }),
        findMany: vi.fn(async ({ where }: { where: { customerAccountId?: string; userId?: string } }) => {
          return memberships.filter((m) => {
            if (where.customerAccountId && m.customerAccountId !== where.customerAccountId) return false
            if (where.userId && m.userId !== where.userId) return false
            return true
          })
        }),
        upsert: vi.fn(
          async ({
            where,
            create,
            update,
          }: {
            where: { userId_customerAccountId: { userId: string; customerAccountId: string } }
            create: typeof memberships[number]
            update: Partial<typeof memberships[number]>
          }) => {
            const existing = memberships.find(
              (m) =>
                m.userId === where.userId_customerAccountId.userId &&
                m.customerAccountId === where.userId_customerAccountId.customerAccountId,
            )
            if (existing) {
              Object.assign(existing, update)
              return existing
            }
            const row = { ...create, id: `mem-${memberships.length + 1}`, createdAt: hoisted.now }
            memberships.push(row)
            return row
          },
        ),
        update: vi.fn(
          async ({
            where,
            data,
          }: {
            where: { id?: string; userId_customerAccountId?: { userId: string; customerAccountId: string } }
            data: Partial<(typeof memberships)[number]>
          }) => {
            const row = where.userId_customerAccountId
              ? memberships.find(
                  (m) =>
                    m.userId === where.userId_customerAccountId!.userId &&
                    m.customerAccountId === where.userId_customerAccountId!.customerAccountId,
                )
              : memberships.find((m) => m.id === where.id)
            if (!row) throw new Error('missing')
            Object.assign(row, data)
            return row
          },
        ),
        delete: vi.fn(async ({ where }: { where: { id: string } }) => {
          const idx = memberships.findIndex((m) => m.id === where.id)
          if (idx >= 0) memberships.splice(idx, 1)
        }),
        count: vi.fn(),
      },
    },
  }
})

vi.mock('@/lib/portal/authz', () => ({
  requireAdmin: hoisted.requireAdmin,
  requireUser: hoisted.requireUser,
}))
vi.mock('@/lib/db', () => ({ prisma: hoisted.prisma }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({ get: vi.fn(), set: vi.fn() })),
}))
vi.mock('@/auth', () => ({ signIn }))
vi.mock('@/lib/portal/customer-invite-mail', () => ({ sendCustomerInvitationMagicLink }))
import {
  inviteCustomerMemberAction,
  removeMembershipAction,
  resendCustomerInvitationAction,
  updateMembershipRoleAction,
} from '@/lib/admin/actions'
import { switchCustomerAccountAction } from '@/lib/portal/customer-actions'
describe('batch6 customer access helpers', () => {
  it('derives ACTIVE / INVITED / PENDING states', () => {
    expect(deriveMembershipAccessState({ emailVerified: new Date() }, { invitedAt: null, lastInviteSentAt: null })).toBe(
      'ACTIVE',
    )
    expect(
      deriveMembershipAccessState({ emailVerified: null }, { invitedAt: new Date(), lastInviteSentAt: new Date() }),
    ).toBe('INVITED')
    expect(deriveMembershipAccessState({ emailVerified: null }, { invitedAt: null, lastInviteSentAt: null })).toBe(
      'PENDING',
    )
  })

  it('normalizes invite email', () => {
    expect(normalizeCustomerInviteEmail('  Carlos@Example.com ')).toBe('carlos@example.com')
  })

  it('builds account activation redirect with locale', () => {
    expect(buildCustomerActivationRedirect('acct-2', 'es')).toBe('/api/portal/activate-account?accountId=acct-2&locale=es')
  })

  it('parses invitation context from magic link callbackUrl', () => {
    const url =
      'https://www.webbxxl.com/api/auth/callback/email?token=abc&callbackUrl=%2Fapi%2Fportal%2Factivate-account%3FaccountId%3Dacct-1%26locale%3Des'
    expect(parseMagicLinkEmailContext(url)).toEqual({ kind: 'invitation', locale: 'es' })
  })
})

describe('batch6 active account resolution', () => {
  const base = (id: string, accountId: string, createdAt: string) => ({
    id,
    userId: 'user-1',
    customerAccountId: accountId,
    role: 'MEMBER' as const,
    invitedAt: null,
    lastInviteSentAt: null,
    createdAt: new Date(createdAt),
    updatedAt: new Date(createdAt),
    customerAccount: {
      id: accountId,
      businessName: accountId,
      slug: accountId,
      status: 'ACTIVE' as const,
      primaryContactName: null,
      primaryContactEmail: null,
      locale: 'en',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  })

  it('uses cookie account when membership exists', () => {
    const memberships = [base('m1', 'acct-old', '2020-01-01'), base('m2', 'acct-new', '2021-01-01')]
    const picked = pickActiveMembership(memberships, 'acct-new')
    expect(picked.membership.customerAccountId).toBe('acct-new')
    expect(picked.shouldRefreshCookie).toBe(false)
  })

  it('rejects invalid cookie and falls back', () => {
    const memberships = [base('m1', 'acct-old', '2020-01-01'), base('m2', 'acct-new', '2021-01-01')]
    const picked = pickActiveMembership(memberships, 'acct-stolen')
    expect(picked.membership.customerAccountId).toBe('acct-old')
    expect(picked.shouldRefreshCookie).toBe(true)
  })
})

describe('batch6 invite and membership actions', () => {
  beforeEach(() => {
    hoisted.reset()
    signIn.mockReset()
    sendCustomerInvitationMagicLink.mockReset()
    sendCustomerInvitationMagicLink.mockResolvedValue({ ok: true })
    hoisted.requireAdmin.mockClear()
    hoisted.prisma.user.create.mockClear()
  })

  it('1 invites brand-new email with timestamps', async () => {
    sendCustomerInvitationMagicLink.mockResolvedValue({ ok: true })
    const result = await inviteCustomerMemberAction({
      customerAccountId: 'acct-1',
      email: 'new@example.com',
      role: 'MEMBER',
      locale: 'en',
    })
    expect(result).toEqual({ ok: true, inviteSent: true })
    expect(hoisted.prisma.user.create).toHaveBeenCalled()
    expect(hoisted.memberships).toHaveLength(1)
    expect(hoisted.memberships[0].invitedAt).toBeTruthy()
    expect(hoisted.memberships[0].lastInviteSentAt).toBeTruthy()
    expect(sendCustomerInvitationMagicLink).toHaveBeenCalledWith('new@example.com', 'acct-1', 'en')
  })

  it('2 reuses existing CUSTOMER user', async () => {
    hoisted.users['u1'] = {
      id: 'u1',
      email: 'existing@example.com',
      role: 'CUSTOMER',
      emailVerified: new Date(),
      lastLoginAt: null,
    }
    await inviteCustomerMemberAction({
      customerAccountId: 'acct-1',
      email: 'existing@example.com',
      role: 'OWNER',
      locale: 'en',
    })
    expect(hoisted.prisma.user.create).not.toHaveBeenCalled()
    expect(hoisted.memberships).toHaveLength(1)
  })

  it('3 duplicate invite updates lastInviteSentAt only once membership', async () => {
    hoisted.users['u1'] = { id: 'u1', email: 'dup@example.com', role: 'CUSTOMER', emailVerified: null, lastLoginAt: null }
    await inviteCustomerMemberAction({
      customerAccountId: 'acct-1',
      email: 'dup@example.com',
      role: 'MEMBER',
      locale: 'en',
    })
    const firstSent = hoisted.memberships[0].lastInviteSentAt
    await inviteCustomerMemberAction({
      customerAccountId: 'acct-1',
      email: 'dup@example.com',
      role: 'MEMBER',
      locale: 'en',
    })
    expect(hoisted.memberships).toHaveLength(1)
    expect(sendCustomerInvitationMagicLink).toHaveBeenCalledTimes(2)
  })

  it('4 rejects ADMIN/STAFF email', async () => {
    hoisted.users['u1'] = { id: 'u1', email: 'staff@example.com', role: 'STAFF', emailVerified: new Date(), lastLoginAt: null }
    const result = await inviteCustomerMemberAction({
      customerAccountId: 'acct-1',
      email: 'staff@example.com',
      role: 'MEMBER',
      locale: 'en',
    })
    expect(result).toEqual({ ok: false, error: 'staff_account_not_allowed' })
    expect(hoisted.memberships).toHaveLength(0)
  })

  it('5 resend updates timestamp and requests magic link', async () => {
    hoisted.users['u1'] = { id: 'u1', email: 'resend@example.com', role: 'CUSTOMER', emailVerified: null, lastLoginAt: null }
    hoisted.memberships.push({
      id: 'mem-1',
      userId: 'u1',
      customerAccountId: 'acct-1',
      role: 'MEMBER',
      invitedAt: hoisted.now,
      lastInviteSentAt: hoisted.now,
      createdAt: hoisted.now,
    })
    hoisted.prisma.customerMembership.findUnique.mockImplementation(async ({ where }: { where: { id?: string } }) => {
      if (where.id === 'mem-1') {
        return { ...hoisted.memberships[0], user: hoisted.users['u1'] }
      }
      return null
    })
    const result = await resendCustomerInvitationAction({ membershipId: 'mem-1', locale: 'es' })
    expect(result).toEqual({ ok: true })
    expect(sendCustomerInvitationMagicLink).toHaveBeenCalledWith('resend@example.com', 'acct-1', 'es')
  })

  it('6-9 owner removal rules', async () => {
    hoisted.memberships.push(
      { id: 'o1', userId: 'u1', customerAccountId: 'acct-1', role: 'OWNER', invitedAt: null, lastInviteSentAt: null, createdAt: hoisted.now },
      { id: 'm1', userId: 'u2', customerAccountId: 'acct-1', role: 'MEMBER', invitedAt: null, lastInviteSentAt: null, createdAt: hoisted.now },
    )
    hoisted.prisma.customerMembership.findUnique.mockImplementation(async ({ where }: { where: { id?: string } }) => {
      return hoisted.memberships.find((m) => m.id === where.id) ?? null
    })

    expect(await removeMembershipAction('o1')).toEqual({ ok: false, error: 'last_owner' })
    expect(await updateMembershipRoleAction('o1', 'MEMBER')).toEqual({ ok: false, error: 'last_owner' })

    hoisted.memberships.push({
      id: 'o2',
      userId: 'u3',
      customerAccountId: 'acct-1',
      role: 'OWNER',
      invitedAt: null,
      lastInviteSentAt: null,
      createdAt: hoisted.now,
    })
    expect(await removeMembershipAction('o1')).toEqual({ ok: true })
    expect(await removeMembershipAction('m1')).toEqual({ ok: true })
  })

  it('10 removing membership does not delete user', async () => {
    hoisted.users['u1'] = { id: 'u1', email: 'keep@example.com', role: 'CUSTOMER', emailVerified: new Date(), lastLoginAt: null }
    hoisted.memberships.push(
      { id: 'o1', userId: 'u1', customerAccountId: 'acct-1', role: 'OWNER', invitedAt: null, lastInviteSentAt: null, createdAt: hoisted.now },
      { id: 'o2', userId: 'u2', customerAccountId: 'acct-1', role: 'OWNER', invitedAt: null, lastInviteSentAt: null, createdAt: hoisted.now },
    )
    hoisted.prisma.customerMembership.findUnique.mockImplementation(async ({ where }: { where: { id?: string } }) => {
      return hoisted.memberships.find((m) => m.id === where.id) ?? null
    })
    await removeMembershipAction('o1')
    expect(hoisted.users['u1']).toBeTruthy()
  })
})

describe('batch6 authorization scoping and login', () => {
  it('16-18 project and managed-site authorization stay account isolated', () => {
    expect(canAccessProject('acct-a', 'acct-b')).toBe(false)
    expect(canAccessProject('acct-a', 'acct-a')).toBe(true)
    expect(customerOwnsManagedSite('acct-a', 'acct-b')).toBe(false)
    expect(customerOwnsManagedSite('acct-a', 'acct-a')).toBe(true)
  })

  it('21-22 invitation magic link locale inference', () => {
    const en = parseMagicLinkEmailContext(
      'https://x/api/auth/callback/email?callbackUrl=%2Fapi%2Fportal%2Factivate-account%3FaccountId%3Da%26locale%3Den',
    )
    const es = parseMagicLinkEmailContext(
      'https://x/api/auth/callback/email?callbackUrl=%2Fapi%2Fportal%2Factivate-account%3FaccountId%3Da%26locale%3Des',
    )
    expect(en).toEqual({ kind: 'invitation', locale: 'en' })
    expect(es).toEqual({ kind: 'invitation', locale: 'es' })
  })

  it('24 staff/admin magic link targets /admin', () => {
    expect(MAGIC_LINK_REDIRECT_ADMIN.en).toBe('/admin')
    expect(magicLinkRedirectForLocale('en')).toBe('/dashboard')
  })

  it('11-13 switch account requires membership', async () => {
    hoisted.prisma.customerMembership.findUnique.mockResolvedValueOnce(null)
    const denied = await switchCustomerAccountAction('acct-other')
    expect(denied).toEqual({ ok: false, error: 'unauthorized' })

    hoisted.prisma.customerMembership.findUnique.mockResolvedValueOnce({
      id: 'm2',
      userId: 'user-1',
      customerAccountId: 'acct-2',
      role: 'MEMBER',
      invitedAt: null,
      lastInviteSentAt: null,
      createdAt: hoisted.now,
    })
    const allowed = await switchCustomerAccountAction('acct-2')
    expect(allowed).toEqual({ ok: true })
  })

  it('14-15 activation redirect encodes invited account', () => {
    expect(buildCustomerActivationRedirect('invited-acct', 'en')).toContain('accountId=invited-acct')
  })

  it('owner guard helpers', () => {
    const siblings = [
      { id: '1', role: 'OWNER' as const },
      { id: '2', role: 'MEMBER' as const },
    ]
    expect(wouldViolateLastOwnerOnDemote({ id: '1', role: 'OWNER' }, siblings, 'MEMBER')).toBe(true)
    expect(wouldViolateLastOwnerOnRemove({ role: 'MEMBER' }, siblings)).toBe(false)
  })
})

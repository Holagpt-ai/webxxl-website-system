import { beforeEach, describe, expect, it, vi } from 'vitest'

const auth = vi.hoisted(() => vi.fn())
const requireCustomerMembership = vi.hoisted(() => vi.fn())
const hoisted = vi.hoisted(() => ({
  projectFileFindUnique: vi.fn(),
  membershipFindFirst: vi.fn(),
  notificationFindFirst: vi.fn(),
  notificationUpdate: vi.fn(),
  userFindUnique: vi.fn(),
}))

vi.mock('@/auth', () => ({ auth }))
vi.mock('@/lib/db', () => ({
  prisma: {
    user: { findUnique: hoisted.userFindUnique },
    projectFile: { findUnique: hoisted.projectFileFindUnique },
    customerMembership: { findFirst: hoisted.membershipFindFirst },
    notification: {
      findFirst: hoisted.notificationFindFirst,
      update: hoisted.notificationUpdate,
    },
  },
}))
vi.mock('@/lib/portal/authz', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/portal/authz')>()
  return {
    ...actual,
    requireCustomerMembership,
  }
})
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { authorizeProjectFileRead, AuthError } from '@/lib/portal/authz'
import { markNotificationReadAction } from '@/lib/automation/customer-actions'
import { GET as downloadProjectFile } from '@/app/api/files/[fileId]/route'

const fileRow = {
  id: 'file-a',
  storageKey: 'projects/p1/logo.png',
  project: { customerAccountId: 'acct-a' },
}

beforeEach(() => {
  vi.clearAllMocks()
  hoisted.userFindUnique.mockImplementation(async ({ where }: { where: { id: string } }) => {
    if (where.id === 'staff-1') return { id: 'staff-1', role: 'STAFF', email: 'staff@webbxxl.com' }
    if (where.id === 'cust-1') return { id: 'cust-1', role: 'CUSTOMER', email: 'a@example.com' }
    return null
  })
  hoisted.projectFileFindUnique.mockResolvedValue(fileRow)
  requireCustomerMembership.mockResolvedValue({
    id: 'cust-1',
    customerAccount: { id: 'acct-b' },
  })
})

describe('batch16 file download authorization', () => {
  it('denies a signed-in customer who is not a member of the file account', async () => {
    auth.mockResolvedValue({ user: { id: 'cust-1' } })
    hoisted.membershipFindFirst.mockResolvedValue(null)
    await expect(authorizeProjectFileRead('file-a')).rejects.toBeInstanceOf(AuthError)
  })

  it('allows a customer who belongs to the file account', async () => {
    auth.mockResolvedValue({ user: { id: 'cust-1' } })
    hoisted.membershipFindFirst.mockResolvedValue({ customerAccountId: 'acct-a' })
    const result = await authorizeProjectFileRead('file-a')
    expect(result.file.id).toBe('file-a')
  })

  it('allows staff without a customer membership check', async () => {
    auth.mockResolvedValue({ user: { id: 'staff-1' } })
    const result = await authorizeProjectFileRead('file-a')
    expect(result.file.id).toBe('file-a')
    expect(hoisted.membershipFindFirst).not.toHaveBeenCalled()
  })

  it('returns 403 from the download route when authorization fails', async () => {
    auth.mockResolvedValue({ user: { id: 'cust-1' } })
    hoisted.membershipFindFirst.mockResolvedValue(null)
    const res = await downloadProjectFile(new Request('http://localhost/api/files/file-a'), {
      params: Promise.resolve({ fileId: 'file-a' }),
    })
    expect(res.status).toBe(403)
  })
})

describe('batch16 multi-account notification isolation', () => {
  it('does not mark a notification scoped to another active customer account', async () => {
    hoisted.notificationFindFirst.mockResolvedValue(null)
    const result = await markNotificationReadAction('notif-other-acct')
    expect(result).toEqual({ ok: false, error: 'not_found' })
    expect(hoisted.notificationFindFirst).toHaveBeenCalledWith({
      where: {
        id: 'notif-other-acct',
        userId: 'cust-1',
        OR: [{ customerAccountId: 'acct-b' }, { customerAccountId: null }],
      },
    })
    expect(hoisted.notificationUpdate).not.toHaveBeenCalled()
  })

  it('marks read when notification matches active account scope', async () => {
    hoisted.notificationFindFirst.mockResolvedValue({ id: 'notif-1', readAt: null })
    hoisted.notificationUpdate.mockResolvedValue({})
    const result = await markNotificationReadAction('notif-1')
    expect(result).toEqual({ ok: true })
    expect(hoisted.notificationUpdate).toHaveBeenCalled()
  })
})

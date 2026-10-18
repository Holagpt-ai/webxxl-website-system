import { beforeEach, describe, expect, it, vi } from 'vitest'

const auth = vi.fn()
const findFirst = vi.fn()
const findUnique = vi.fn()

vi.mock('@/auth', () => ({ auth }))
vi.mock('@/lib/db', () => ({
  prisma: {
    customerMembership: { findFirst },
    user: { findUnique },
  },
}))

vi.mock('@/config/workflow-backend', () => ({
  isWorkflowReadEnabled: () => true,
}))

describe('workflow read authorization (AUTO-10A)', () => {
  beforeEach(() => {
    auth.mockReset()
    findFirst.mockReset()
    findUnique.mockReset()
  })

  it('O: ordinary user cannot list platform-wide jobs', async () => {
    auth.mockResolvedValue({ user: { id: 'u1' } })
    findUnique.mockResolvedValue({ id: 'u1', role: 'CUSTOMER' })
    const { resolveWorkflowReadScope } = await import('@/lib/platform/workflow/route-auth')
    await expect(resolveWorkflowReadScope(null)).rejects.toThrow('FORBIDDEN')
  })

  it('P: account-null job requires platform staff', async () => {
    const { authorizeWorkflowJobRead } = await import('@/lib/platform/workflow/route-auth')
    await expect(
      authorizeWorkflowJobRead(
        { customerAccountId: null },
        { kind: 'account', userId: 'u1', customerAccountId: 'acct' },
      ),
    ).rejects.toThrow('NOT_FOUND')
  })

  it('account member can read own tenant job', async () => {
    const { authorizeWorkflowJobRead } = await import('@/lib/platform/workflow/route-auth')
    await expect(
      authorizeWorkflowJobRead(
        { customerAccountId: 'acct-a' },
        { kind: 'account', userId: 'u1', customerAccountId: 'acct-a' },
      ),
    ).resolves.toBeUndefined()
  })
})

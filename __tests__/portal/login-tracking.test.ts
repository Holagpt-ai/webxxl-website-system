import { describe, expect, it, vi } from 'vitest'

const update = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({
  prisma: { user: { update } },
}))

import { touchUserLastLogin } from '@/lib/portal/login-tracking'

describe('login tracking', () => {
  it('updates lastLoginAt on success', async () => {
    update.mockResolvedValueOnce({})
    await expect(touchUserLastLogin('user-1')).resolves.toBe(true)
  })

  it('does not throw when update fails', async () => {
    update.mockRejectedValueOnce(new Error('db_fail'))
    await expect(touchUserLastLogin('user-1')).resolves.toBe(false)
  })
})

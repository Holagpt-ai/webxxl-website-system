import { prisma } from '@/lib/db'
import type { MktResult } from '@/lib/platform/marketing/types'

export async function assertActiveAccountMembership(input: {
  customerAccountId: string
  userId: string
}): Promise<MktResult<true>> {
  const membership = await prisma.customerMembership.findUnique({
    where: {
      userId_customerAccountId: {
        userId: input.userId,
        customerAccountId: input.customerAccountId,
      },
    },
  })
  if (!membership) {
    return { ok: false, code: 'FORBIDDEN', message: 'User is not an active member of this account' }
  }
  return { ok: true, value: true }
}

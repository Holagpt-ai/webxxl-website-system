import { prisma } from '@/lib/db'
import type { PortalUser } from '@/lib/portal/authz'
import type { User } from '@prisma/client'

/**
 * Read-only composition context for staff drilling into a customer account.
 * Does not grant billing-group sibling access or substitute for customer session auth on mutation APIs.
 */
export async function buildStaffCompositionPortal(
  staffUser: User,
  customerAccountId: string,
): Promise<PortalUser | null> {
  const customerAccount = await prisma.customerAccount.findUnique({ where: { id: customerAccountId } })
  if (!customerAccount) return null

  const membership = await prisma.customerMembership.findFirst({
    where: { customerAccountId },
    orderBy: { createdAt: 'asc' },
    include: { customerAccount: true },
  })

  if (membership) {
    return {
      ...staffUser,
      membership,
      customerAccount: membership.customerAccount,
    }
  }

  return {
    ...staffUser,
    membership: {
      id: `staff_read_${customerAccountId}`,
      userId: staffUser.id,
      customerAccountId,
      role: 'MEMBER',
      invitedAt: null,
      lastInviteSentAt: null,
      createdAt: customerAccount.createdAt,
      updatedAt: customerAccount.updatedAt,
    },
    customerAccount,
  }
}

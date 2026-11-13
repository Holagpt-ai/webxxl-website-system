import { prisma } from '@/lib/db'
import { isStaffRole } from '@/lib/admin/roles'
import type { PortalUser } from '@/lib/portal/authz'
import type { User } from '@prisma/client'

export const STAFF_COMPOSITION_CONTEXT_KIND = 'staff_readonly_composition' as const

export type StaffCompositionReadContext = {
  kind: typeof STAFF_COMPOSITION_CONTEXT_KIND
  staffUserId: string
  portal: PortalUser
}

export function isStaffCompositionMembershipId(membershipId: string): boolean {
  return membershipId.startsWith('staff_composition_')
}

/**
 * Verified staff read-only composition for a customer account.
 * Never reuses another user's CustomerMembership; execution composers receive staff identity with synthetic scope only.
 */
export async function buildStaffCompositionPortal(
  staffUser: User,
  customerAccountId: string,
): Promise<StaffCompositionReadContext | null> {
  if (!isStaffRole(staffUser.role)) return null

  const customerAccount = await prisma.customerAccount.findUnique({ where: { id: customerAccountId } })
  if (!customerAccount) return null

  const portal: PortalUser = {
    ...staffUser,
    membership: {
      id: `staff_composition_${customerAccountId}`,
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

  return {
    kind: STAFF_COMPOSITION_CONTEXT_KIND,
    staffUserId: staffUser.id,
    portal,
  }
}

export async function verifyStaffManagedSiteForAccount(
  customerAccountId: string,
  managedSiteId: string,
): Promise<{ ok: true; managedSiteId: string } | { ok: false; message: string }> {
  const site = await prisma.managedSite.findFirst({
    where: { id: managedSiteId, customerAccountId },
    select: { id: true },
  })
  if (!site) {
    return { ok: false, message: 'Managed site not found for customer account' }
  }
  return { ok: true, managedSiteId: site.id }
}

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { prisma } from '@/lib/db'
import {
  STAFF_COMPOSITION_CONTEXT_KIND,
  buildStaffCompositionPortal,
  isStaffCompositionMembershipId,
  verifyStaffManagedSiteForAccount,
} from '@/lib/platform/admin-operations/staff-portal-context'

vi.mock('@/lib/db', () => ({
  prisma: {
    customerAccount: { findUnique: vi.fn() },
    customerMembership: { findFirst: vi.fn() },
    managedSite: { findFirst: vi.fn() },
  },
}))

const STAFF = {
  id: 'staff_user_1',
  role: 'STAFF',
  email: 'staff@example.com',
  name: 'Staff',
} as const

const OTHER_MEMBER = {
  id: 'customer_member_99',
  userId: 'customer_member_99',
  customerAccountId: 'acct_a',
  role: 'OWNER' as const,
}

describe('Batch 7 staff composition context', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.customerAccount.findUnique).mockResolvedValue({
      id: 'acct_a',
      businessName: 'A Co',
      status: 'ACTIVE',
      createdAt: new Date('2020-01-01'),
      updatedAt: new Date('2020-01-01'),
    } as never)
    vi.mocked(prisma.customerMembership.findFirst).mockResolvedValue(OTHER_MEMBER as never)
  })

  it('does not reuse another customer membership for staff composition', async () => {
    const result = await buildStaffCompositionPortal(STAFF as never, 'acct_a')
    expect(result).not.toBeNull()
    expect(prisma.customerMembership.findFirst).not.toHaveBeenCalled()
    expect(result?.kind).toBe(STAFF_COMPOSITION_CONTEXT_KIND)
    expect(result?.staffUserId).toBe(STAFF.id)
    expect(result?.portal.id).toBe(STAFF.id)
    expect(result?.portal.membership.userId).toBe(STAFF.id)
    expect(result?.portal.membership.id).toBe('staff_composition_acct_a')
    expect(isStaffCompositionMembershipId(result!.portal.membership.id)).toBe(true)
  })

  it('rejects non-staff operators', async () => {
    const result = await buildStaffCompositionPortal({ ...STAFF, role: 'CUSTOMER' } as never, 'acct_a')
    expect(result).toBeNull()
  })

  it('verifies managed site tenant binding', async () => {
    vi.mocked(prisma.managedSite.findFirst).mockResolvedValueOnce({ id: 'site_a' } as never)
    await expect(verifyStaffManagedSiteForAccount('acct_a', 'site_a')).resolves.toEqual({
      ok: true,
      managedSiteId: 'site_a',
    })
    expect(prisma.managedSite.findFirst).toHaveBeenCalledWith({
      where: { id: 'site_a', customerAccountId: 'acct_a' },
      select: { id: true },
    })

    vi.mocked(prisma.managedSite.findFirst).mockResolvedValueOnce(null)
    await expect(verifyStaffManagedSiteForAccount('acct_a', 'site_other')).resolves.toEqual({
      ok: false,
      message: 'Managed site not found for customer account',
    })
  })
})

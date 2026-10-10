import { cookies } from 'next/headers'
import type { CustomerAccount, CustomerMembership } from '@prisma/client'

export const ACTIVE_CUSTOMER_ACCOUNT_COOKIE = 'webxxl_active_customer_account'

export type MembershipWithAccount = CustomerMembership & { customerAccount: CustomerAccount }

export function pickActiveMembership(
  memberships: MembershipWithAccount[],
  activeAccountId: string | undefined | null,
): { membership: MembershipWithAccount; shouldRefreshCookie: boolean } {
  if (memberships.length === 0) {
    throw new Error('no_memberships')
  }
  const ordered = [...memberships].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
  if (activeAccountId) {
    const match = ordered.find((m) => m.customerAccountId === activeAccountId)
    if (match) return { membership: match, shouldRefreshCookie: false }
    return { membership: ordered[0], shouldRefreshCookie: true }
  }
  return { membership: ordered[0], shouldRefreshCookie: false }
}

export async function getActiveCustomerAccountIdFromCookie(): Promise<string | undefined> {
  const store = await cookies()
  return store.get(ACTIVE_CUSTOMER_ACCOUNT_COOKIE)?.value
}

export async function setActiveCustomerAccountCookie(accountId: string): Promise<void> {
  const store = await cookies()
  store.set(ACTIVE_CUSTOMER_ACCOUNT_COOKIE, accountId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  })
}

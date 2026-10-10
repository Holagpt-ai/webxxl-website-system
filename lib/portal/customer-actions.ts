'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireUser } from '@/lib/portal/authz'
import { setActiveCustomerAccountCookie } from '@/lib/portal/active-customer-account'

export type CustomerPortalActionResult = { ok: true } | { ok: false; error: string }

export async function switchCustomerAccountAction(customerAccountId: string): Promise<CustomerPortalActionResult> {
  try {
    const user = await requireUser()
    const membership = await prisma.customerMembership.findUnique({
      where: { userId_customerAccountId: { userId: user.id, customerAccountId } },
    })
    if (!membership) return { ok: false, error: 'unauthorized' }
    await setActiveCustomerAccountCookie(customerAccountId)
    revalidatePath('/dashboard', 'layout')
    revalidatePath('/es/dashboard', 'layout')
    return { ok: true }
  } catch {
    return { ok: false, error: 'unauthorized' }
  }
}

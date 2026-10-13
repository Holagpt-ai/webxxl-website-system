'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireCustomerMembership, requireUser } from '@/lib/portal/authz'
import { setActiveCustomerAccountCookie } from '@/lib/portal/active-customer-account'
import { setActiveProjectCookie } from '@/lib/portal/active-project'

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

export async function switchCustomerProjectAction(projectId: string): Promise<CustomerPortalActionResult> {
  try {
    const portal = await requireCustomerMembership()
    const project = await prisma.project.findFirst({
      where: { id: projectId, customerAccountId: portal.customerAccount.id },
      select: { id: true },
    })
    if (!project) return { ok: false, error: 'unauthorized' }
    await setActiveProjectCookie(project.id)
    revalidatePath('/dashboard', 'layout')
    revalidatePath('/es/dashboard', 'layout')
    return { ok: true }
  } catch {
    return { ok: false, error: 'unauthorized' }
  }
}

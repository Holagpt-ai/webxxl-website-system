'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireCustomerMembership } from '@/lib/portal/authz'
import { updateCustomerNotificationPreference } from '@/lib/automation/preferences'
import { isEnabled } from '@/config/features'
import { customerNotificationWhere } from '@/lib/portal/notification-scope'

export type AutomationCustomerActionResult = { ok: true } | { ok: false; error: string }

function revalidateCustomerAutomation() {
  revalidatePath('/dashboard/notifications')
  revalidatePath('/es/dashboard/notifications')
  revalidatePath('/dashboard/settings/notifications')
  revalidatePath('/es/dashboard/settings/notifications')
}

export async function markNotificationReadAction(notificationId: string): Promise<AutomationCustomerActionResult> {
  if (!isEnabled('automationNotifications')) return { ok: false, error: 'disabled' }
  try {
    const portal = await requireCustomerMembership()
    const row = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        ...customerNotificationWhere(portal.id, portal.customerAccount.id),
      },
    })
    if (!row) return { ok: false, error: 'not_found' }
    if (!row.readAt) {
      await prisma.notification.update({ where: { id: notificationId }, data: { readAt: new Date() } })
    }
    revalidateCustomerAutomation()
    return { ok: true }
  } catch {
    return { ok: false, error: 'unauthorized' }
  }
}

export async function markAllNotificationsReadAction(): Promise<AutomationCustomerActionResult> {
  if (!isEnabled('automationNotifications')) return { ok: false, error: 'disabled' }
  try {
    const portal = await requireCustomerMembership()
    await prisma.notification.updateMany({
      where: { ...customerNotificationWhere(portal.id, portal.customerAccount.id), readAt: null },
      data: { readAt: new Date() },
    })
    revalidateCustomerAutomation()
    return { ok: true }
  } catch {
    return { ok: false, error: 'unauthorized' }
  }
}

export async function updateNotificationPreferencesAction(input: {
  projectUpdates: boolean
  messagesAndApprovals: boolean
  serviceOrders: boolean
  infrastructureRenewals: boolean
  transactionalEmail: boolean
}): Promise<AutomationCustomerActionResult> {
  if (!isEnabled('automationNotifications')) return { ok: false, error: 'disabled' }
  try {
    const portal = await requireCustomerMembership()
    await updateCustomerNotificationPreference({
      userId: portal.id,
      customerAccountId: portal.customerAccount.id,
      ...input,
    })
    revalidateCustomerAutomation()
    return { ok: true }
  } catch {
    return { ok: false, error: 'unauthorized' }
  }
}

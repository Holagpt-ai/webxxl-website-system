import { prisma } from '@/lib/db'
import type { AutomationDeliveryStatus } from '@prisma/client'
import { customerNotificationWhere } from '@/lib/portal/notification-scope'

export async function listCustomerNotifications(userId: string, customerAccountId: string) {
  return prisma.notification.findMany({
    where: customerNotificationWhere(userId, customerAccountId),
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
}

export async function listAdminAutomationJobs(filters?: {
  status?: AutomationDeliveryStatus
  customerAccountId?: string
  q?: string
}) {
  const q = filters?.q?.trim()
  return prisma.automationDeliveryJob.findMany({
    where: {
      status: filters?.status,
      ...(filters?.customerAccountId
        ? { event: { customerAccountId: filters.customerAccountId } }
        : {}),
      ...(q
        ? {
            OR: [
              { dedupeKey: { contains: q, mode: 'insensitive' } },
              { lastErrorClass: { contains: q, mode: 'insensitive' } },
              { event: { dedupeKey: { contains: q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: 'desc' },
    take: 100,
    include: {
      event: {
        select: {
          id: true,
          eventType: true,
          dedupeKey: true,
          customerAccountId: true,
          createdAt: true,
          customerAccount: { select: { id: true, businessName: true } },
        },
      },
      recipientUser: { select: { id: true, email: true, name: true } },
    },
  })
}

export async function getDeliveryStatusForNotifications(userId: string, notificationIds: string[]) {
  if (notificationIds.length === 0) return []
  return prisma.automationDeliveryJob.findMany({
    where: {
      recipientUserId: userId,
      channel: 'IN_APP',
      providerRef: { in: notificationIds },
    },
    select: { providerRef: true, status: true, deliveredAt: true, lastErrorClass: true },
  })
}

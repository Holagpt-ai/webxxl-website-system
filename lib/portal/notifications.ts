import { prisma } from '@/lib/db'
import type { NotificationType } from '@prisma/client'

export type CreateNotificationInput = {
  userId: string
  customerAccountId?: string
  type: NotificationType
  title: string
  body: string
  actionUrl?: string
}

export async function createNotification(input: CreateNotificationInput) {
  return prisma.notification.create({
    data: {
      userId: input.userId,
      customerAccountId: input.customerAccountId,
      type: input.type,
      title: input.title,
      body: input.body,
      actionUrl: input.actionUrl,
    },
  })
}

/** Hooks for domain events — email/SMS automation can subscribe later. */
export const notificationHooks = {
  async onDependencyRequested(userId: string, customerAccountId: string, title: string, actionUrl: string) {
    return createNotification({
      userId,
      customerAccountId,
      type: 'DEPENDENCY_REQUESTED',
      title: 'Action needed on your project',
      body: title,
      actionUrl,
    })
  },
  async onApprovalRequested(userId: string, customerAccountId: string, title: string, actionUrl: string) {
    return createNotification({
      userId,
      customerAccountId,
      type: 'APPROVAL_REQUESTED',
      title: 'Approval requested',
      body: title,
      actionUrl,
    })
  },
  async onProjectMessage(userId: string, customerAccountId: string, preview: string, actionUrl: string) {
    return createNotification({
      userId,
      customerAccountId,
      type: 'PROJECT_MESSAGE',
      title: 'New project message',
      body: preview,
      actionUrl,
    })
  },
}

import { prisma } from '@/lib/db'
import type { NotificationType } from '@prisma/client'
import { preferredLocaleForUser } from '@/lib/i18n/preference-db'
import { isNotificationTemplateKey, renderSystemNotification, type NotificationTemplateKey } from '@/lib/i18n/notifications'

export type CreateNotificationInput = {
  userId: string
  customerAccountId?: string
  type: NotificationType
  title: string
  body: string
  actionUrl?: string
  templateKey?: NotificationTemplateKey
  templateVars?: Record<string, string>
}

async function copyForUser(input: {
  userId: string
  title: string
  body: string
  templateKey?: NotificationTemplateKey
  templateVars?: Record<string, string>
}) {
  if (input.templateKey && isNotificationTemplateKey(input.templateKey)) {
    const locale = await preferredLocaleForUser(input.userId)
    return renderSystemNotification(locale, input.templateKey, input.templateVars ?? {})
  }
  return { title: input.title, body: input.body }
}

export async function createNotification(input: CreateNotificationInput) {
  const copy = await copyForUser(input)
  return prisma.notification.create({
    data: {
      userId: input.userId,
      customerAccountId: input.customerAccountId,
      type: input.type,
      title: copy.title,
      body: copy.body,
      actionUrl: input.actionUrl,
    },
  })
}

export async function notifyStaffUsers(input: {
  type: NotificationType
  title: string
  body: string
  actionUrl?: string
  customerAccountId?: string
  templateKey?: NotificationTemplateKey
  templateVars?: Record<string, string>
}) {
  const staff = await prisma.user.findMany({
    where: { role: { in: ['STAFF', 'ADMIN'] } },
    select: { id: true },
  })
  await Promise.all(
    staff.map((user) =>
      createNotification({
        userId: user.id,
        customerAccountId: input.customerAccountId,
        type: input.type,
        title: input.title,
        body: input.body,
        actionUrl: input.actionUrl,
        templateKey: input.templateKey,
        templateVars: input.templateVars,
      }),
    ),
  )
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
      templateKey: 'dependencyRequested',
      templateVars: { title },
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
      templateKey: 'approvalRequested',
      templateVars: { title },
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
      templateKey: 'newProjectMessage',
      templateVars: { preview },
    })
  },
}

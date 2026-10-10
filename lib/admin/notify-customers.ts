import { prisma } from '@/lib/db'
import { createNotification } from '@/lib/portal/notifications'
import type { NotificationType } from '@prisma/client'

export async function notifyCustomerAccountMembers(input: {
  customerAccountId: string
  type: NotificationType
  title: string
  body: string
  actionUrl?: string
}) {
  const memberships = await prisma.customerMembership.findMany({
    where: { customerAccountId: input.customerAccountId },
    select: { userId: true },
  })
  await Promise.all(
    memberships.map((m) =>
      createNotification({
        userId: m.userId,
        customerAccountId: input.customerAccountId,
        type: input.type,
        title: input.title,
        body: input.body,
        actionUrl: input.actionUrl,
      }),
    ),
  )
}

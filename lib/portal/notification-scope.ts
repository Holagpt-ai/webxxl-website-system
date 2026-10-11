import type { Prisma } from '@prisma/client'

/** Scope in-app notifications to the active customer account (multi-tenant membership safe). */
export function customerNotificationWhere(
  userId: string,
  customerAccountId: string,
): Prisma.NotificationWhereInput {
  return {
    userId,
    OR: [{ customerAccountId }, { customerAccountId: null }],
  }
}

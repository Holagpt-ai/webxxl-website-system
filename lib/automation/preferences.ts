import { prisma } from '@/lib/db'
import type { PreferenceCategory } from '@/lib/automation/registry'

const DEFAULTS = {
  projectUpdates: true,
  messagesAndApprovals: true,
  serviceOrders: true,
  infrastructureRenewals: true,
  transactionalEmail: true,
} as const

export async function getCustomerNotificationPreference(userId: string, customerAccountId: string) {
  return prisma.customerNotificationPreference.upsert({
    where: { userId_customerAccountId: { userId, customerAccountId } },
    create: { userId, customerAccountId, ...DEFAULTS },
    update: {},
  })
}

export function isChannelAllowedByPreference(
  prefs: Awaited<ReturnType<typeof getCustomerNotificationPreference>>,
  category: PreferenceCategory,
  channel: 'IN_APP' | 'EMAIL',
  essential?: boolean,
): boolean {
  if (essential || category === 'essential') return true
  if (channel === 'EMAIL' && !prefs.transactionalEmail) return false
  switch (category) {
    case 'projectUpdates':
      return prefs.projectUpdates
    case 'messagesAndApprovals':
      return prefs.messagesAndApprovals
    case 'serviceOrders':
      return prefs.serviceOrders
    case 'infrastructureRenewals':
      return prefs.infrastructureRenewals
    case 'transactionalEmail':
      return prefs.transactionalEmail
    default:
      return true
  }
}

export async function updateCustomerNotificationPreference(input: {
  userId: string
  customerAccountId: string
  projectUpdates: boolean
  messagesAndApprovals: boolean
  serviceOrders: boolean
  infrastructureRenewals: boolean
  transactionalEmail: boolean
}) {
  return prisma.customerNotificationPreference.upsert({
    where: { userId_customerAccountId: { userId: input.userId, customerAccountId: input.customerAccountId } },
    create: { ...input },
    update: {
      projectUpdates: input.projectUpdates,
      messagesAndApprovals: input.messagesAndApprovals,
      serviceOrders: input.serviceOrders,
      infrastructureRenewals: input.infrastructureRenewals,
      transactionalEmail: input.transactionalEmail,
    },
  })
}

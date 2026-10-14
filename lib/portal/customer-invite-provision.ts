import type { MembershipRole } from '@prisma/client'
import { prisma } from '@/lib/db'
import { isStaffRole } from '@/lib/admin/roles'
import type { UserRole } from '@prisma/client'
import {
  isAllowedInviteRole,
  isValidCustomerInviteEmail,
  normalizeCustomerInviteEmail,
  type CustomerAccessLocale,
} from '@/lib/portal/customer-access'

export type ProvisionCustomerInviteResult =
  | { ok: true; inviteSent: boolean; inviteError?: string }
  | { ok: false; error: string }

/**
 * Creates or updates membership, then sends magic link when requested.
 * lastInviteSentAt is set only after successful email delivery.
 */
export async function provisionCustomerInvite(input: {
  customerAccountId: string
  email: string
  role: MembershipRole
  locale: CustomerAccessLocale
  sendEmail: boolean
}): Promise<ProvisionCustomerInviteResult> {
  const normalized = normalizeCustomerInviteEmail(input.email)
  if (!normalized || !isValidCustomerInviteEmail(normalized)) return { ok: false, error: 'invalid_email' }
  if (!isAllowedInviteRole(input.role)) return { ok: false, error: 'invalid_email' }

  let user = await prisma.user.findUnique({ where: { email: normalized } })
  if (user && isStaffRole(user.role as UserRole)) return { ok: false, error: 'staff_account_not_allowed' }
  if (!user) {
    user = await prisma.user.create({
      data: { email: normalized, role: 'CUSTOMER', emailVerified: null },
    })
  } else if (user.role !== 'CUSTOMER') {
    return { ok: false, error: 'staff_account_not_allowed' }
  }

  const now = new Date()
  const existing = await prisma.customerMembership.findUnique({
    where: { userId_customerAccountId: { userId: user.id, customerAccountId: input.customerAccountId } },
  })

  await prisma.customerMembership.upsert({
    where: { userId_customerAccountId: { userId: user.id, customerAccountId: input.customerAccountId } },
    create: {
      userId: user.id,
      customerAccountId: input.customerAccountId,
      role: input.role,
      invitedAt: now,
    },
    update: {
      role: input.role,
      invitedAt: existing?.invitedAt ?? now,
    },
  })

  if (!input.sendEmail) return { ok: true, inviteSent: false }

  const { sendCustomerInvitationMagicLink } = await import('@/lib/portal/customer-invite-mail')
  const mail = await sendCustomerInvitationMagicLink(normalized, input.customerAccountId, input.locale)
  if (!mail.ok) return { ok: true, inviteSent: false, inviteError: mail.error }

  await prisma.customerMembership.update({
    where: { userId_customerAccountId: { userId: user.id, customerAccountId: input.customerAccountId } },
    data: { lastInviteSentAt: new Date() },
  })

  return { ok: true, inviteSent: true }
}

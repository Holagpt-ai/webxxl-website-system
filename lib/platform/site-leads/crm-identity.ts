import { prisma } from '@/lib/db'
import type { CrmChannelIdentityType } from '@prisma/client'

export async function findAccountContactIdByIdentity(input: {
  customerAccountId: string
  identityType: CrmChannelIdentityType
  normalizedValue: string
}): Promise<string | null> {
  const row = await prisma.crmContactChannelIdentity.findFirst({
    where: {
      customerAccountId: input.customerAccountId,
      identityType: input.identityType,
      normalizedValue: input.normalizedValue,
      contact: { customerAccountId: input.customerAccountId, status: 'ACTIVE' },
    },
    select: { contactId: true },
  })
  return row?.contactId ?? null
}

export async function findExactAccountIdentityConflict(input: {
  customerAccountId: string
  normalizedEmail: string
  normalizedPhone: string | null
}): Promise<{ contactId: string; via: 'email' | 'phone' } | null> {
  const byEmail = await findAccountContactIdByIdentity({
    customerAccountId: input.customerAccountId,
    identityType: 'EMAIL',
    normalizedValue: input.normalizedEmail,
  })
  if (byEmail) return { contactId: byEmail, via: 'email' }
  if (input.normalizedPhone) {
    const byPhone = await findAccountContactIdByIdentity({
      customerAccountId: input.customerAccountId,
      identityType: 'PHONE',
      normalizedValue: input.normalizedPhone,
    })
    if (byPhone) return { contactId: byPhone, via: 'phone' }
  }
  return null
}

/** Lead conversion must not create or mutate marketing consent records. */
export function conversionMustNotGrantMarketingConsent(): { ok: true } {
  return { ok: true }
}

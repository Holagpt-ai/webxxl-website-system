import type { CrmConsentChannel, PrismaClient } from '@prisma/client'
import { normalizeEmail, normalizePhone } from '@/lib/platform/crm/normalize'
import type { CommsResult } from '@/lib/platform/comms/types'

export type BoundRecipientAddress = {
  normalizedAddress: string
  identityType: 'EMAIL' | 'PHONE' | 'WHATSAPP'
  contactId: string
}

function channelToIdentityType(channel: CrmConsentChannel): 'EMAIL' | 'PHONE' | 'WHATSAPP' | null {
  if (channel === 'EMAIL') return 'EMAIL'
  if (channel === 'SMS') return 'PHONE'
  if (channel === 'WHATSAPP') return 'WHATSAPP'
  return null
}

export function normalizeRecipientAddressForChannel(
  channel: CrmConsentChannel,
  recipientAddress: string,
): CommsResult<string> {
  const trimmed = recipientAddress?.trim() ?? ''
  if (!trimmed) {
    return { ok: false, code: 'VALIDATION', message: 'Recipient address required' }
  }
  if (channel === 'EMAIL') {
    return { ok: true, value: normalizeEmail(trimmed) }
  }
  if (channel === 'SMS' || channel === 'WHATSAPP' || channel === 'VOICE') {
    return { ok: true, value: normalizePhone(trimmed) }
  }
  return { ok: false, code: 'VALIDATION', message: 'Unsupported channel for recipient binding' }
}

/**
 * When a CRM contact is used for consent, the destination must be a current
 * channel identity of that same contact (tenant-scoped). Prevents consent A + destination B.
 */
export async function assertRecipientMatchesCrmContact(
  db: PrismaClient,
  input: {
    customerAccountId: string
    crmContactId: string
    channel: CrmConsentChannel
    recipientAddress: string
  },
): Promise<CommsResult<BoundRecipientAddress>> {
  const identityType = channelToIdentityType(input.channel)
  if (!identityType) {
    return { ok: false, code: 'FORBIDDEN', message: 'Channel does not support CRM contact destination binding' }
  }

  const normalized = normalizeRecipientAddressForChannel(input.channel, input.recipientAddress)
  if (!normalized.ok) return normalized

  const contact = await db.crmContact.findFirst({
    where: { id: input.crmContactId, customerAccountId: input.customerAccountId },
    select: { id: true },
  })
  if (!contact) {
    return { ok: false, code: 'NOT_FOUND', message: 'CRM contact not found for account' }
  }

  const identity = await db.crmContactChannelIdentity.findFirst({
    where: {
      customerAccountId: input.customerAccountId,
      contactId: input.crmContactId,
      identityType,
      normalizedValue: normalized.value,
    },
    select: { id: true, normalizedValue: true, identityType: true },
  })
  if (!identity) {
    return {
      ok: false,
      code: 'FORBIDDEN',
      message: 'Recipient address does not match CRM contact channel identity for consent scope',
    }
  }

  return {
    ok: true,
    value: {
      normalizedAddress: identity.normalizedValue,
      identityType,
      contactId: input.crmContactId,
    },
  }
}

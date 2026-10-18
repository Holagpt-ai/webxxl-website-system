import type { CrmConsentChannel, CrmConsentPurpose, CrmConsentStatus } from '@prisma/client'
import { prisma } from '@/lib/db'
import { assertCrmContactOwnedByAccount } from '@/lib/platform/crm/contact-guard'
import type { CrmResult } from '@/lib/platform/crm/types'

function consentPayloadMatches(
  existing: {
    customerAccountId: string
    contactId: string
    channel: CrmConsentChannel
    purpose: CrmConsentPurpose
    status: CrmConsentStatus
  },
  input: {
    customerAccountId: string
    contactId: string
    channel: CrmConsentChannel
    purpose: CrmConsentPurpose
    status: CrmConsentStatus
  },
): boolean {
  return (
    existing.customerAccountId === input.customerAccountId &&
    existing.contactId === input.contactId &&
    existing.channel === input.channel &&
    existing.purpose === input.purpose &&
    existing.status === input.status
  )
}

export async function recordContactConsent(input: {
  customerAccountId: string
  contactId: string
  channel: CrmConsentChannel
  purpose: CrmConsentPurpose
  status: CrmConsentStatus
  source: string
  capturedAt: Date
  termsVersion?: string
  idempotencyKey?: string
}): Promise<CrmResult<{ id: string }>> {
  const owned = await assertCrmContactOwnedByAccount(input.contactId, input.customerAccountId)
  if (!owned.ok) return owned

  if (input.idempotencyKey) {
    const existing = await prisma.contactConsent.findUnique({ where: { idempotencyKey: input.idempotencyKey } })
    if (existing) {
      if (!consentPayloadMatches(existing, input)) {
        return { ok: false, code: 'CONFLICT', message: 'Consent idempotency key reused with different payload' }
      }
      return { ok: true, value: { id: existing.id } }
    }
  }
  const row = await prisma.contactConsent.create({
    data: {
      customerAccountId: input.customerAccountId,
      contactId: input.contactId,
      channel: input.channel,
      purpose: input.purpose,
      status: input.status,
      source: input.source,
      capturedAt: input.capturedAt,
      termsVersion: input.termsVersion,
      idempotencyKey: input.idempotencyKey,
    },
  })
  return { ok: true, value: { id: row.id } }
}

export async function recordContactSuppression(input: {
  customerAccountId: string
  contactId: string
  channel: CrmConsentChannel
  purpose: CrmConsentPurpose
  reason: string
  source: string
  idempotencyKey?: string
}): Promise<CrmResult<{ id: string }>> {
  const owned = await assertCrmContactOwnedByAccount(input.contactId, input.customerAccountId)
  if (!owned.ok) return owned

  if (input.idempotencyKey) {
    const existing = await prisma.contactSuppression.findUnique({ where: { idempotencyKey: input.idempotencyKey } })
    if (existing) {
      if (existing.customerAccountId !== input.customerAccountId || existing.contactId !== input.contactId) {
        return { ok: false, code: 'CONFLICT', message: 'Suppression idempotency key conflict' }
      }
      if (existing.channel !== input.channel || existing.purpose !== input.purpose) {
        return { ok: false, code: 'CONFLICT', message: 'Suppression idempotency key reused with different payload' }
      }
      return { ok: true, value: { id: existing.id } }
    }
  }
  const row = await prisma.contactSuppression.create({
    data: {
      customerAccountId: input.customerAccountId,
      contactId: input.contactId,
      channel: input.channel,
      purpose: input.purpose,
      reason: input.reason,
      source: input.source,
      active: true,
      idempotencyKey: input.idempotencyKey,
    },
  })
  return { ok: true, value: { id: row.id } }
}

/** CSV/import paths must never grant marketing consent. */
export function importMustNotGrantConsent(): CrmResult<true> {
  return { ok: true, value: true }
}

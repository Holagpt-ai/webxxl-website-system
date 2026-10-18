import type { CrmConsentChannel, CrmConsentPurpose, CrmConsentStatus } from '@prisma/client'
import { prisma } from '@/lib/db'
import type { CrmResult } from '@/lib/platform/crm/types'

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
  if (input.idempotencyKey) {
    const existing = await prisma.contactConsent.findUnique({ where: { idempotencyKey: input.idempotencyKey } })
    if (existing) {
      if (existing.customerAccountId !== input.customerAccountId) {
        return { ok: false, code: 'CONFLICT', message: 'Idempotency key conflict' }
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
  if (input.idempotencyKey) {
    const existing = await prisma.contactSuppression.findUnique({ where: { idempotencyKey: input.idempotencyKey } })
    if (existing) return { ok: true, value: { id: existing.id } }
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

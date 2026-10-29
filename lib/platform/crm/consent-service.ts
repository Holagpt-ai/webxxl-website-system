import type { CrmConsentChannel, CrmConsentPurpose, CrmConsentStatus, Prisma } from '@prisma/client'
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

export async function listContactConsentAndSuppression(
  customerAccountId: string,
  contactId: string,
): Promise<
  CrmResult<{
    consents: Awaited<ReturnType<typeof prisma.contactConsent.findMany>>
    suppressions: Awaited<ReturnType<typeof prisma.contactSuppression.findMany>>
  }>
> {
  const owned = await assertCrmContactOwnedByAccount(contactId, customerAccountId)
  if (!owned.ok) return owned
  const [consents, suppressions] = await Promise.all([
    prisma.contactConsent.findMany({
      where: { customerAccountId, contactId },
      orderBy: { capturedAt: 'desc' },
      take: 100,
      include: { evidence: true },
    }),
    prisma.contactSuppression.findMany({
      where: { customerAccountId, contactId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
  ])
  return { ok: true, value: { consents, suppressions } }
}

export async function recordContactConsentWithEvidence(input: {
  customerAccountId: string
  contactId: string
  channel: CrmConsentChannel
  purpose: CrmConsentPurpose
  status: CrmConsentStatus
  source: string
  capturedAt: Date
  termsVersion?: string
  idempotencyKey?: string
  evidence?: { evidenceRef: string; detail?: Record<string, unknown> }[]
}): Promise<CrmResult<{ id: string }>> {
  const evidenceRows = (input.evidence ?? []).filter((row) => row.evidenceRef?.trim())
  if (input.status === 'GRANTED' && !evidenceRows.length) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'GRANTED consent requires evidence' }
  }
  if (input.source === 'crm.import' || input.source === 'import.csv') {
    return { ok: false, code: 'FORBIDDEN', message: 'Import paths cannot record consent via API' }
  }

  const owned = await assertCrmContactOwnedByAccount(input.contactId, input.customerAccountId)
  if (!owned.ok) return owned

  try {
    return await prisma.$transaction(async (tx) => {
      if (input.idempotencyKey) {
        const existing = await tx.contactConsent.findUnique({ where: { idempotencyKey: input.idempotencyKey } })
        if (existing) {
          if (!consentPayloadMatches(existing, input)) {
            return { ok: false as const, code: 'CONFLICT' as const, message: 'Consent idempotency key reused with different payload' }
          }
          if (existing.customerAccountId !== input.customerAccountId) {
            return { ok: false as const, code: 'CONFLICT' as const, message: 'Consent idempotency key conflict' }
          }
          return { ok: true as const, value: { id: existing.id } }
        }
      }

      const row = await tx.contactConsent.create({
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

      if (evidenceRows.length) {
        await tx.contactConsentEvidence.createMany({
          data: evidenceRows.map((evidenceRow) => ({
            consentId: row.id,
            evidenceRef: evidenceRow.evidenceRef.trim(),
            detail: (evidenceRow.detail ?? undefined) as Prisma.InputJsonValue | undefined,
          })),
        })
      }

      return { ok: true as const, value: { id: row.id } }
    })
  } catch (error) {
    const prismaError = error as { code?: string }
    if (prismaError.code === 'P2002' && input.idempotencyKey) {
      const existing = await prisma.contactConsent.findUnique({ where: { idempotencyKey: input.idempotencyKey } })
      if (existing && consentPayloadMatches(existing, input) && existing.customerAccountId === input.customerAccountId) {
        return { ok: true, value: { id: existing.id } }
      }
      return { ok: false, code: 'CONFLICT', message: 'Consent idempotency key conflict' }
    }
    throw error
  }
}

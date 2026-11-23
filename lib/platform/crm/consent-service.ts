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

const IMPORT_SUPPRESSION_SOURCES = new Set(['crm.import', 'import.csv'])

/** CSV/import paths must never grant marketing consent. */
export function importMustNotGrantConsent(): CrmResult<true> {
  return { ok: true, value: true }
}

/** CSV/import paths must never lift opt-outs. */
export function importMustNotLiftSuppression(): CrmResult<true> {
  return { ok: true, value: true }
}

export async function liftContactSuppression(input: {
  customerAccountId: string
  contactId: string
  actorUserId: string
  reason: string
  source: string
  suppressionId?: string
  channel?: CrmConsentChannel
  purpose?: CrmConsentPurpose
  idempotencyKey?: string
}): Promise<CrmResult<{ id: string; alreadyLifted: boolean; consentUnchanged: true }>> {
  const owned = await assertCrmContactOwnedByAccount(input.contactId, input.customerAccountId)
  if (!owned.ok) return owned

  if (IMPORT_SUPPRESSION_SOURCES.has(input.source.trim())) {
    return { ok: false, code: 'FORBIDDEN', message: 'Import paths cannot lift suppression' }
  }

  if (input.idempotencyKey) {
    const existingLift = await prisma.contactSuppression.findUnique({
      where: { liftIdempotencyKey: input.idempotencyKey },
    })
    if (existingLift) {
      if (
        existingLift.customerAccountId !== input.customerAccountId ||
        existingLift.contactId !== input.contactId
      ) {
        return { ok: false, code: 'CONFLICT', message: 'Suppression lift idempotency key conflict' }
      }
      return { ok: true, value: { id: existingLift.id, alreadyLifted: true, consentUnchanged: true } }
    }
  }

  const active = input.suppressionId
    ? await prisma.contactSuppression.findFirst({
        where: {
          id: input.suppressionId,
          customerAccountId: input.customerAccountId,
          contactId: input.contactId,
        },
      })
    : await prisma.contactSuppression.findFirst({
        where: {
          customerAccountId: input.customerAccountId,
          contactId: input.contactId,
          channel: input.channel,
          purpose: input.purpose,
          active: true,
        },
        orderBy: { createdAt: 'desc' },
      })

  if (!active) {
    return { ok: false, code: 'NOT_FOUND', message: 'Active suppression not found' }
  }
  if (active.customerAccountId !== input.customerAccountId || active.contactId !== input.contactId) {
    return { ok: false, code: 'CROSS_ACCOUNT_DENIED', message: 'Suppression belongs to another account' }
  }
  if (!active.active) {
    return { ok: true, value: { id: active.id, alreadyLifted: true, consentUnchanged: true } }
  }

  const liftedAt = new Date()
  await prisma.contactSuppression.update({
    where: { id: active.id },
    data: {
      active: false,
      liftedAt,
      liftedByUserId: input.actorUserId,
      liftReason: input.reason.trim(),
      liftIdempotencyKey: input.idempotencyKey,
    },
  })
  return { ok: true, value: { id: active.id, alreadyLifted: false, consentUnchanged: true } }
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

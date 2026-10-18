import { prisma } from '@/lib/db'
import { normalizeEmail } from '@/lib/platform/crm/normalize'
import type { CommsResult } from '@/lib/platform/comms/types'

export type ContactResolutionOutcome =
  | { kind: 'MATCHED'; crmContactId: string; confidence: 'HIGH' }
  | { kind: 'RECONCILIATION'; candidateId: string; confidence: 'LOW' | 'MEDIUM' }
  | { kind: 'UNMATCHED'; confidence: 'NONE' }

export async function resolveInboundChatwootContact(input: {
  customerAccountId: string
  email?: string
  phone?: string
  externalContactRef: string
}): Promise<CommsResult<ContactResolutionOutcome>> {
  if (input.email) {
    const identity = await prisma.crmContactChannelIdentity.findFirst({
      where: {
        customerAccountId: input.customerAccountId,
        identityType: 'EMAIL',
        normalizedValue: normalizeEmail(input.email),
      },
    })
    if (identity) {
      return { ok: true, value: { kind: 'MATCHED', crmContactId: identity.contactId, confidence: 'HIGH' } }
    }
  }
  if (input.phone) {
    const identity = await prisma.crmContactChannelIdentity.findFirst({
      where: {
        customerAccountId: input.customerAccountId,
        identityType: 'PHONE',
        normalizedValue: input.phone.replace(/\D/g, ''),
      },
    })
    if (identity) {
      return { ok: true, value: { kind: 'MATCHED', crmContactId: identity.contactId, confidence: 'HIGH' } }
    }
  }

  const candidate = await prisma.contactReconciliationCandidate.upsert({
    where: {
      customerAccountId_sourceSystem_externalContactRef: {
        customerAccountId: input.customerAccountId,
        sourceSystem: 'chatwoot',
        externalContactRef: input.externalContactRef,
      },
    },
    create: {
      customerAccountId: input.customerAccountId,
      sourceSystem: 'chatwoot',
      externalContactRef: input.externalContactRef,
      identityType: input.email ? 'EMAIL' : input.phone ? 'PHONE' : 'UNKNOWN',
      normalizedValue: input.email ? normalizeEmail(input.email) : input.phone ?? 'unknown',
      confidence: 'LOW',
      evidence: { email: input.email ? '[redacted]' : undefined, phone: input.phone ? '[redacted]' : undefined },
      status: 'PENDING_REVIEW',
    },
    update: { updatedAt: new Date() },
  })

  return {
    ok: true,
    value: { kind: 'RECONCILIATION', candidateId: candidate.id, confidence: 'LOW' },
  }
}

/** Cross-account identity must never auto-merge. */
export async function rejectCrossAccountIdentityMatch(input: {
  identityAccountId: string
  targetAccountId: string
}): Promise<CommsResult<true>> {
  if (input.identityAccountId !== input.targetAccountId) {
    return { ok: false, code: 'FORBIDDEN', message: 'Cross-account contact match denied' }
  }
  return { ok: true, value: true }
}

import type { PrismaClient } from '@prisma/client'
import type { CrmConsentChannel, CrmConsentPurpose, CommsDataClassification } from '@prisma/client'
import type { OutboundAuthorizationInput } from '@/lib/platform/comms/outbound-authorization-gateway'
import type { CommsResult } from '@/lib/platform/comms/types'
import { resolveEffectiveAiActor, resolveServerDataClassification } from '@/lib/platform/comms/intent-auth'
import { buildCommunicationContentHash } from '@/lib/platform/comms/intent-hash'
import { prisma as defaultPrisma } from '@/lib/db'

export type LoadOutboundAuthorizationInput = {
  customerAccountId: string
  actorUserId: string
  channel: CrmConsentChannel
  purpose: CrmConsentPurpose
  recipientAddress: string
  crmContactId?: string
  senderIdentityId?: string
  managedSiteId?: string
  contentVersion: string
  policyVersion: string
  idempotencyKey: string
  dataClassification?: CommsDataClassification
  aiActor?: boolean
  humanApprovalGranted?: boolean
  quoteId?: string
  approvedRegulatedWorkflow?: boolean
  /** When true, marks cross-account conversation attempt for fail-closed denial. */
  attemptedCrossAccountConversation?: boolean
}

/**
 * Trusted server-side loader for Batch 35 outbound authorization inputs.
 * Never trusts client-supplied consent, suppression, sender, membership, or wallet facts.
 */
export async function loadOutboundAuthorizationInput(
  input: LoadOutboundAuthorizationInput,
  db: PrismaClient = defaultPrisma,
): Promise<CommsResult<OutboundAuthorizationInput & { contentFingerprint: string }>> {
  const contentFingerprint = buildCommunicationContentHash({
    customerAccountId: input.customerAccountId,
    senderIdentityId: input.senderIdentityId ?? null,
    recipient: input.recipientAddress,
    channel: input.channel,
    purpose: input.purpose,
    contentVersion: input.contentVersion,
    policyVersion: input.policyVersion,
  })

  const existing = await db.communicationIntent.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    select: { customerAccountId: true, contentHash: true },
  })
  if (existing && existing.customerAccountId !== input.customerAccountId) {
    return { ok: false, code: 'CONFLICT', message: 'Intent idempotency key bound to another account' }
  }

  const memberships = await db.customerMembership.findMany({
    where: { userId: input.actorUserId },
    select: { userId: true, customerAccountId: true },
  })
  const operatingMemberships = memberships.map((row) => ({
    userId: row.userId,
    customerAccountId: row.customerAccountId,
  }))

  const billingMemberships = await db.billingGroupMembership.findMany({
    where: { customerAccountId: input.customerAccountId, status: 'ACTIVE' },
    select: { billingGroupId: true },
  })
  const billingGroupIds = billingMemberships.map((row) => row.billingGroupId)
  const siblingRows =
    billingGroupIds.length > 0
      ? await db.billingGroupMembership.findMany({
          where: { billingGroupId: { in: billingGroupIds }, status: 'ACTIVE' },
          select: { billingGroupId: true, customerAccountId: true },
        })
      : []
  const billingGroupSiblingAccounts = new Map<string, string[]>()
  for (const row of siblingRows) {
    const list = billingGroupSiblingAccounts.get(row.billingGroupId) ?? []
    list.push(row.customerAccountId)
    billingGroupSiblingAccounts.set(row.billingGroupId, list)
  }

  let senderVerified = false
  let senderUseCaseRegistered = false
  let emailDomainVerified: boolean | undefined
  let senderClassification: CommsDataClassification | null = null
  if (input.senderIdentityId) {
    const sender = await db.senderIdentity.findFirst({
      where: {
        id: input.senderIdentityId,
        customerAccountId: input.customerAccountId,
        revokedAt: null,
      },
    })
    if (!sender) return { ok: false, code: 'NOT_FOUND', message: 'Sender identity not found for account' }
    if (sender.channel !== input.channel) {
      return { ok: false, code: 'FORBIDDEN', message: 'Sender identity channel mismatch' }
    }
    senderVerified = sender.verificationState === 'VERIFIED'
    senderUseCaseRegistered =
      sender.registrationStatus === 'REGISTERED' || sender.registrationStatus === 'NOT_REQUIRED'
    if (sender.channel === 'EMAIL') {
      emailDomainVerified = sender.registrationStatus === 'REGISTERED'
    }
    senderClassification = sender.dataClassification
  }

  let suppressed = false
  let consentStatus: 'GRANTED' | 'REVOKED' | 'UNKNOWN' | 'NONE' = 'UNKNOWN'
  if (input.crmContactId) {
    const contact = await db.crmContact.findFirst({
      where: { id: input.crmContactId, customerAccountId: input.customerAccountId },
      select: { id: true },
    })
    if (!contact) return { ok: false, code: 'NOT_FOUND', message: 'CRM contact not found for account' }

    const suppression = await db.contactSuppression.findFirst({
      where: {
        customerAccountId: input.customerAccountId,
        contactId: input.crmContactId,
        channel: input.channel,
        purpose: input.purpose,
        active: true,
      },
      select: { id: true },
    })
    suppressed = Boolean(suppression)

    const consent = await db.contactConsent.findFirst({
      where: {
        customerAccountId: input.customerAccountId,
        contactId: input.crmContactId,
        channel: input.channel,
        purpose: input.purpose,
      },
      orderBy: { capturedAt: 'desc' },
      select: { status: true },
    })
    consentStatus = consent?.status === 'GRANTED' ? 'GRANTED' : consent ? 'REVOKED' : 'UNKNOWN'
  }

  const chatwootMapping = await db.chatwootTenantMapping.findFirst({
    where: { customerAccountId: input.customerAccountId, revokedAt: null },
    select: { verificationState: true },
  })
  const providerConnected = chatwootMapping?.verificationState === 'VERIFIED'

  let walletQuoteAvailable = false
  if (input.quoteId) {
    const quote = await db.communicationQuote.findFirst({
      where: { id: input.quoteId, customerAccountId: input.customerAccountId },
      select: {
        expiresAt: true,
        estimatedUnits: true,
        maxApprovedCredits: true,
        ratePlanVersion: true,
        contentHash: true,
      },
    })
    if (!quote) return { ok: false, code: 'NOT_FOUND', message: 'Communication quote not found for account' }
    if (quote.expiresAt > new Date() && quote.estimatedUnits > 0 && (quote.ratePlanVersion || quote.maxApprovedCredits)) {
      walletQuoteAvailable = true
    }
  }

  const dataClassification = resolveServerDataClassification({
    clientClassification: input.dataClassification,
    senderClassification,
  })
  const aiActor = await resolveEffectiveAiActor({
    actorUserId: input.actorUserId,
    customerAccountId: input.customerAccountId,
    clientAiActor: input.aiActor,
  })

  return {
    ok: true,
    value: {
      customerAccountId: input.customerAccountId,
      managedSiteId: input.managedSiteId,
      actorUserId: input.actorUserId,
      channel: input.channel,
      purpose: input.purpose,
      recipientAccountId: input.customerAccountId,
      crmContactId: input.crmContactId,
      consentStatus,
      suppressed,
      senderIdentityId: input.senderIdentityId,
      senderVerified,
      senderUseCaseRegistered,
      emailDomainVerified,
      dataClassification,
      approvedRegulatedWorkflow: input.approvedRegulatedWorkflow === true,
      aiActor,
      humanApprovalGranted: input.humanApprovalGranted,
      providerConnected,
      walletQuoteAvailable,
      idempotencyKey: input.idempotencyKey,
      contentFingerprint,
      existingIntentFingerprint: existing?.contentHash,
      operatingMemberships,
      billingGroupSiblingAccounts,
      attemptedCrossAccountConversation: input.attemptedCrossAccountConversation === true,
    },
  }
}

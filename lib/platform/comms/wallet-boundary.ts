import { isWalletCommsIntegrationEnabled, isWalletReservationEnabled } from '@/config/wallet-backend'
import { isCommunicationsOutboundEnabled } from '@/config/comms-backend'
import type { CommsResult } from '@/lib/platform/comms/types'
import type { PrismaClient } from '@prisma/client'
import { reserveCredits } from '@/lib/platform/wallet/durable-service'
import { estimateMessagingCost } from '@/lib/platform/wallet/rate-plan'

export type CommsWalletPrepareInput = {
  billingGroupId: string
  customerAccountId: string
  managedSiteId?: string
  intentId: string
  actorUserId: string
  correlationId: string
  idempotencyKey: string
  reservationExpiresAt: Date
}

/**
 * Quote → approval → reservation preparation. Stops before external transport.
 * All quote/intent/content/credit bounds are loaded server-side — never trust client estimates.
 */
export async function prepareCommsWalletReservation(
  prisma: PrismaClient,
  input: CommsWalletPrepareInput,
): Promise<CommsResult<{ reservationId: string }>> {
  if (!isWalletCommsIntegrationEnabled()) {
    return { ok: false, code: 'NOT_CONFIGURED', message: 'Wallet/comms integration disabled' }
  }
  if (!isWalletReservationEnabled()) {
    return { ok: false, code: 'NOT_CONFIGURED', message: 'Wallet reservation disabled' }
  }
  if (isCommunicationsOutboundEnabled()) {
    return { ok: false, code: 'FORBIDDEN', message: 'Outbound must remain off until full gateway activation' }
  }

  const intent = await prisma.communicationIntent.findFirst({
    where: { id: input.intentId, customerAccountId: input.customerAccountId },
    include: {
      approvals: { orderBy: { decidedAt: 'desc' }, take: 1 },
    },
  })
  if (!intent) return { ok: false, code: 'NOT_FOUND', message: 'Communication intent not found' }
  if (!intent.quoteId) return { ok: false, code: 'FORBIDDEN', message: 'Intent missing bound communication quote' }

  const quote = await prisma.communicationQuote.findFirst({
    where: { id: intent.quoteId, customerAccountId: input.customerAccountId },
  })
  if (!quote) return { ok: false, code: 'NOT_FOUND', message: 'Communication quote not found' }
  if (quote.expiresAt <= new Date()) return { ok: false, code: 'FORBIDDEN', message: 'Quote expired' }
  if (quote.billingGroupId && quote.billingGroupId !== input.billingGroupId) {
    return { ok: false, code: 'FORBIDDEN', message: 'Billing group mismatch for quote' }
  }
  if (intent.contentHash !== quote.contentHash) {
    return { ok: false, code: 'FORBIDDEN', message: 'Intent content hash does not match approved quote' }
  }
  if (intent.channel !== quote.channel || intent.purpose !== quote.purpose) {
    return { ok: false, code: 'FORBIDDEN', message: 'Intent channel/purpose mismatch with quote' }
  }

  if (intent.approvalRequired) {
    const latest = intent.approvals[0]
    if (!latest || latest.decision !== 'APPROVED') {
      return { ok: false, code: 'FORBIDDEN', message: 'Human approval required before wallet reservation' }
    }
  }

  if (input.managedSiteId) {
    const site = await prisma.managedSite.findFirst({
      where: { id: input.managedSiteId, customerAccountId: input.customerAccountId },
    })
    if (!site) return { ok: false, code: 'FORBIDDEN', message: 'Managed site not owned by operating account' }
  }

  if (quote.senderIdentityId) {
    const sender = await prisma.senderIdentity.findFirst({
      where: {
        id: quote.senderIdentityId,
        customerAccountId: input.customerAccountId,
        revokedAt: null,
      },
    })
    if (!sender) return { ok: false, code: 'FORBIDDEN', message: 'Sender identity invalid for account' }
    if (sender.channel !== quote.channel) {
      return { ok: false, code: 'FORBIDDEN', message: 'Sender identity channel mismatch' }
    }
  }

  const maxCredits = quote.maxApprovedCredits ?? quote.estimatedUnits
  if (maxCredits == null || maxCredits <= 0) {
    return { ok: false, code: 'FORBIDDEN', message: 'Quote missing authorized credit ceiling' }
  }

  const rateVersion = quote.ratePlanVersion ?? quote.unitCostVersion ?? 'wallet09-fixture-v1'
  const estimate = estimateMessagingCost({
    channel: quote.channel === 'EMAIL' ? 'EMAIL' : 'SMS',
    providerKey: quote.channel === 'EMAIL' ? 'resend' : 'twilio',
    body: quote.contentHash ?? '',
    purpose: quote.purpose,
    rateVersion,
  })
  if (!estimate.ok) return { ok: false, code: 'FORBIDDEN', message: 'Cost unavailable for reservation' }
  if (estimate.value.estimatedTotalCredits > maxCredits) {
    return { ok: false, code: 'FORBIDDEN', message: 'Quote max authorized credits exceeded by rate version' }
  }

  const reserved = await reserveCredits(prisma, {
    principal: { kind: 'SERVICE', serviceId: 'comms-gateway' },
    billingGroupId: input.billingGroupId,
    customerAccountId: input.customerAccountId,
    managedSiteId: input.managedSiteId,
    channel: quote.channel,
    usagePurpose: quote.purpose,
    rateVersion,
    amount: maxCredits,
    correlationId: input.correlationId,
    campaignId: intent.id,
    idempotencyKey: input.idempotencyKey,
    expiresAt: input.reservationExpiresAt,
  })
  if (!reserved.ok) {
    return { ok: false, code: 'FORBIDDEN', message: reserved.error }
  }
  return { ok: true, value: { reservationId: reserved.value.id } }
}

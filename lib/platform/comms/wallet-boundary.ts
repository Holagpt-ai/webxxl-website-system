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
  channel: 'SMS' | 'EMAIL'
  purpose: string
  actorUserId: string
  quoteId: string
  contentBody: string
  estimatedCredits: number
  rateVersion: string
  correlationId: string
  idempotencyKey: string
  expiresAt: Date
}

/**
 * Quote → approval → reservation preparation. Stops before external transport.
 * Does not debit on draft save; reservation requires explicit preparation call.
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

  const quote = await prisma.communicationQuote.findFirst({
    where: { id: input.quoteId, customerAccountId: input.customerAccountId },
  })
  if (!quote) return { ok: false, code: 'NOT_FOUND', message: 'Communication quote not found' }
  if (quote.expiresAt <= new Date()) return { ok: false, code: 'FORBIDDEN', message: 'Quote expired' }

  const estimate = estimateMessagingCost({
    channel: input.channel,
    providerKey: input.channel === 'SMS' ? 'twilio' : 'resend',
    body: input.contentBody,
    purpose: input.purpose,
    rateVersion: input.rateVersion,
  })
  if (!estimate.ok) return { ok: false, code: 'FORBIDDEN', message: 'Cost unavailable for reservation' }
  if (estimate.value.estimatedTotalCredits > input.estimatedCredits) {
    return { ok: false, code: 'FORBIDDEN', message: 'Quote max cost exceeded by current rate version' }
  }

  const reserved = await reserveCredits(prisma, {
    actorUserId: input.actorUserId,
    billingGroupId: input.billingGroupId,
    customerAccountId: input.customerAccountId,
    managedSiteId: input.managedSiteId,
    channel: input.channel,
    usagePurpose: input.purpose,
    rateVersion: input.rateVersion,
    amount: input.estimatedCredits,
    correlationId: input.correlationId,
    idempotencyKey: input.idempotencyKey,
    expiresAt: input.expiresAt,
  })
  if (!reserved.ok) {
    return { ok: false, code: 'FORBIDDEN', message: reserved.error }
  }
  return { ok: true, value: { reservationId: reserved.value.id } }
}

import type { PrismaClient } from '@prisma/client'
import { validateCreditAmount } from '@/lib/platform/wallet/validation'

export type TopUpQuoteInput = {
  billingGroupId: string
  creditAmount: number
  fiatMinorUnits: number
  currency?: string
  priceVersion: string
  providerKey?: string
  expiresAt: Date
  idempotencyKey: string
  payerUserId?: string
}

/** Prepares a checkout quote only. Does not mint wallet credits or start live checkout. */
export async function prepareWalletTopUpQuote(prisma: PrismaClient, input: TopUpQuoteInput) {
  const amountCheck = validateCreditAmount(input.creditAmount)
  if (!amountCheck.ok) return { ok: false as const, error: 'INVALID_AMOUNT' as const }

  const existing = await prisma.walletTopUpQuote.findUnique({ where: { idempotencyKey: input.idempotencyKey } })
  if (existing) {
    if (existing.billingGroupId !== input.billingGroupId || existing.creditAmount !== input.creditAmount) {
      return { ok: false as const, error: 'IDEMPOTENCY_CONFLICT' as const }
    }
    return { ok: true as const, value: existing }
  }

  const quote = await prisma.walletTopUpQuote.create({
    data: {
      billingGroupId: input.billingGroupId,
      creditAmount: input.creditAmount,
      fiatMinorUnits: input.fiatMinorUnits,
      currency: input.currency ?? 'USD',
      priceVersion: input.priceVersion,
      providerKey: input.providerKey,
      status: 'DRAFT',
      expiresAt: input.expiresAt,
      idempotencyKey: input.idempotencyKey,
      payerUserId: input.payerUserId,
    },
  })
  return { ok: true as const, value: quote }
}

/** Credits require verified WalletFundingEvidence — quotes alone never increase balance. */
export async function mintCreditsFromFundingEvidence(
  _prisma: PrismaClient,
  _externalPaymentRef: string,
): Promise<{ ok: false; error: 'UNAUTHORIZED_SETTLE' }> {
  return { ok: false, error: 'UNAUTHORIZED_SETTLE' }
}

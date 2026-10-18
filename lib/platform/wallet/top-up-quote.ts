import type { PrismaClient } from '@prisma/client'
import { createHash } from 'crypto'
import { validateCreditAmount } from '@/lib/platform/wallet/validation'
import { resolveWalletCreditPack } from '@/lib/platform/wallet/top-up-pricing'

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

function buildTopUpQuoteFingerprint(input: TopUpQuoteInput): string {
  const payload = [
    input.billingGroupId,
    String(input.creditAmount),
    String(input.fiatMinorUnits),
    input.currency ?? 'USD',
    input.priceVersion,
    input.providerKey ?? '',
    input.expiresAt.toISOString(),
  ].join('|')
  return createHash('sha256').update(payload).digest('hex')
}

/** Prepares a checkout quote only. Does not mint wallet credits or start live checkout. */
export async function prepareWalletTopUpQuote(prisma: PrismaClient, input: TopUpQuoteInput) {
  const amountCheck = validateCreditAmount(input.creditAmount)
  if (!amountCheck.ok) return { ok: false as const, error: 'INVALID_AMOUNT' as const }
  if (!Number.isSafeInteger(input.fiatMinorUnits) || input.fiatMinorUnits <= 0) {
    return { ok: false as const, error: 'INVALID_AMOUNT' as const }
  }

  const pack = resolveWalletCreditPack(input.priceVersion, input.creditAmount)
  if (!pack) return { ok: false as const, error: 'QUOTE_UNAVAILABLE' as const }
  if (pack.fiatMinorUnits !== input.fiatMinorUnits) {
    return { ok: false as const, error: 'IDEMPOTENCY_CONFLICT' as const }
  }
  if (input.currency && input.currency !== pack.currency) {
    return { ok: false as const, error: 'IDEMPOTENCY_CONFLICT' as const }
  }
  if (input.providerKey && pack.providerKey && input.providerKey !== pack.providerKey) {
    return { ok: false as const, error: 'IDEMPOTENCY_CONFLICT' as const }
  }

  const fingerprint = buildTopUpQuoteFingerprint(input)

  const existing = await prisma.walletTopUpQuote.findUnique({ where: { idempotencyKey: input.idempotencyKey } })
  if (existing) {
    if (existing.billingGroupId !== input.billingGroupId || existing.creditAmount !== input.creditAmount) {
      return { ok: false as const, error: 'IDEMPOTENCY_CONFLICT' as const }
    }
    return { ok: true as const, value: existing, fingerprint }
  }

  const quote = await prisma.walletTopUpQuote.create({
    data: {
      billingGroupId: input.billingGroupId,
      creditAmount: input.creditAmount,
      fiatMinorUnits: pack.fiatMinorUnits,
      currency: pack.currency,
      priceVersion: input.priceVersion,
      providerKey: pack.providerKey ?? input.providerKey,
      status: 'DRAFT',
      expiresAt: input.expiresAt,
      idempotencyKey: input.idempotencyKey,
      payerUserId: input.payerUserId,
    },
  })
  return { ok: true as const, value: quote, fingerprint }
}

/** Credits require verified WalletFundingEvidence — quotes alone never increase balance. */
export async function mintCreditsFromFundingEvidence(
  _prisma: PrismaClient,
  _externalPaymentRef: string,
): Promise<{ ok: false; error: 'UNAUTHORIZED_SETTLE' }> {
  return { ok: false, error: 'UNAUTHORIZED_SETTLE' }
}

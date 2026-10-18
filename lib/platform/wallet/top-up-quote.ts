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

function buildTopUpQuoteFingerprint(input: TopUpQuoteInput, pack: {
  fiatMinorUnits: number
  currency: string
  providerKey?: string | null
}): string {
  const payload = [
    input.billingGroupId,
    String(input.creditAmount),
    String(pack.fiatMinorUnits),
    pack.currency,
    input.priceVersion,
    pack.providerKey ?? input.providerKey ?? '',
    input.expiresAt.toISOString(),
    input.payerUserId ?? '',
  ].join('|')
  return createHash('sha256').update(payload).digest('hex')
}

function topUpQuoteMaterialMatch(
  existing: {
    billingGroupId: string
    creditAmount: number
    fiatMinorUnits: number
    currency: string
    priceVersion: string
    providerKey: string | null
    expiresAt: Date
    payerUserId: string | null
    requestFingerprint?: string | null
  },
  fingerprint: string,
  pack: { fiatMinorUnits: number; currency: string; providerKey?: string | null },
  input: TopUpQuoteInput,
): boolean {
  if (existing.requestFingerprint && existing.requestFingerprint !== fingerprint) return false
  if (existing.billingGroupId !== input.billingGroupId) return false
  if (existing.creditAmount !== input.creditAmount) return false
  if (existing.fiatMinorUnits !== pack.fiatMinorUnits) return false
  if (existing.currency !== pack.currency) return false
  if (existing.priceVersion !== input.priceVersion) return false
  const provider = pack.providerKey ?? input.providerKey ?? null
  if ((existing.providerKey ?? null) !== provider) return false
  if (existing.expiresAt.toISOString() !== input.expiresAt.toISOString()) return false
  if ((existing.payerUserId ?? null) !== (input.payerUserId ?? null)) return false
  return true
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

  const fingerprint = buildTopUpQuoteFingerprint(input, pack)

  const existing = await prisma.walletTopUpQuote.findUnique({ where: { idempotencyKey: input.idempotencyKey } })
  if (existing) {
    if (!topUpQuoteMaterialMatch(existing, fingerprint, pack, input)) {
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
      requestFingerprint: fingerprint,
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

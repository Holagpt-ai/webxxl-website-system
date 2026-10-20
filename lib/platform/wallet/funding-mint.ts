import type { PrismaClient } from '@prisma/client'
import { isCommerceWalletMintEnabled } from '@/config/commerce-backend'
import { assertWalletMutationAuthorized } from '@/lib/platform/wallet/durable-authz'
import type { WalletResult } from '@/lib/platform/wallet/types'
import { validateCreditAmount } from '@/lib/platform/wallet/validation'

type Tx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

const COMMERCE_FUND_PRINCIPAL = { kind: 'SERVICE' as const, serviceId: 'commerce-fulfillment' as const }

export type CommerceMintValue = {
  ledgerEntryId: string
  orderId: string | null
  deltaCredits: number
  idempotencyKey: string
  replay: boolean
}

/**
 * Issues messaging credits from verified WalletFundingEvidence.
 * Refuses unless COMMERCE_WALLET_MINT_ENABLED is explicitly set.
 * Uses the wallet row lock and a unique ledger idempotency key.
 */
export async function mintCreditsFromVerifiedFundingEvidence(
  prisma: PrismaClient,
  externalPaymentRef: string,
): Promise<WalletResult<CommerceMintValue>> {
  if (!isCommerceWalletMintEnabled()) {
    return { ok: false, error: 'UNAUTHORIZED_SETTLE' }
  }
  const evidence = await prisma.walletFundingEvidence.findUnique({ where: { externalPaymentRef } })
  if (!evidence || !evidence.verifiedAt) {
    return { ok: false, error: 'UNAUTHORIZED_SETTLE' }
  }
  const amount = validateCreditAmount(evidence.creditAmount)
  if (!amount.ok) return { ok: false, error: 'INVALID_AMOUNT' }

  if (evidence.ledgerEntryId) {
    const existing = await prisma.walletLedgerEntry.findUnique({ where: { id: evidence.ledgerEntryId } })
    if (existing) {
      return {
        ok: true,
        value: {
          ledgerEntryId: existing.id,
          orderId: existing.orderId,
          deltaCredits: existing.deltaCredits,
          idempotencyKey: existing.idempotencyKey,
          replay: true,
        },
      }
    }
  }

  return prisma.$transaction(async (tx) => {
    const auth = await assertWalletMutationAuthorized(tx as Tx, {
      principal: COMMERCE_FUND_PRINCIPAL,
      operation: 'FUND',
      billingGroupId: evidence.billingGroupId,
      at: new Date(),
    })
    if (!auth.ok) return auth

    const wallet = await tx.creditWallet.findUnique({ where: { id: evidence.walletId } })
    if (!wallet) return { ok: false as const, error: 'WALLET_NOT_FOUND' as const }
    if (wallet.status !== 'ACTIVE') return { ok: false as const, error: 'WALLET_INACTIVE' as const }

    const idempotencyKey = `commerce-funding:${evidence.id}`
    const existing = await tx.walletLedgerEntry.findUnique({ where: { idempotencyKey } })
    if (existing) {
      if (!evidence.ledgerEntryId) {
        await tx.walletFundingEvidence.update({
          where: { id: evidence.id },
          data: { ledgerEntryId: existing.id },
        })
      }
      return {
        ok: true as const,
        value: {
          ledgerEntryId: existing.id,
          orderId: existing.orderId,
          deltaCredits: existing.deltaCredits,
          idempotencyKey: existing.idempotencyKey,
          replay: true,
        },
      }
    }

    await tx.$queryRaw`SELECT "id" FROM "CreditWallet" WHERE "id" = ${wallet.id} FOR UPDATE`
    const entry = await tx.walletLedgerEntry.create({
      data: {
        walletId: wallet.id,
        type: 'TOP_UP',
        deltaCredits: evidence.creditAmount,
        priceVersion: evidence.priceVersion ?? 'commerce-funding',
        providerRef: evidence.externalPaymentRef,
        orderId: evidence.commerceOrderId,
        idempotencyKey,
        actorUserId: auth.actorUserId,
        actorServiceId: auth.actorServiceId,
      },
    })
    await tx.creditWallet.update({ where: { id: wallet.id }, data: { ledgerSequence: { increment: 1 } } })
    await tx.walletFundingEvidence.update({
      where: { id: evidence.id },
      data: { ledgerEntryId: entry.id },
    })
    return {
      ok: true as const,
      value: {
        ledgerEntryId: entry.id,
        orderId: entry.orderId,
        deltaCredits: entry.deltaCredits,
        idempotencyKey: entry.idempotencyKey,
        replay: false,
      },
    }
  })
}

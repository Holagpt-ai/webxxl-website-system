import type { PrismaClient } from '@prisma/client'
import type { WalletLedgerEntryRecord, WalletResult } from '@/lib/platform/wallet/types'
import { validateCreditAmount } from '@/lib/platform/wallet/validation'
import type { WalletMutationPrincipal } from '@/lib/platform/wallet/mutation-principal'
import { walletPrincipalActorId } from '@/lib/platform/wallet/mutation-principal'
import { assertWalletMutationAuthorized } from '@/lib/platform/wallet/durable-authz'

import { isWalletSyntheticFundingAllowed } from '@/config/wallet-backend'

type Tx = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>

async function lockWalletRow(tx: Tx, walletId: string): Promise<void> {
  await tx.$queryRaw`SELECT "id" FROM "CreditWallet" WHERE "id" = ${walletId} FOR UPDATE`
}

export async function seedSyntheticWalletTopUpForTests(
  prisma: PrismaClient,
  input: {
    billingGroupId: string
    amount: number
    idempotencyKey: string
    principal: WalletMutationPrincipal
  },
): Promise<WalletResult<WalletLedgerEntryRecord>> {
  if (!isWalletSyntheticFundingAllowed()) {
    return { ok: false, error: 'UNAUTHORIZED_SETTLE' }
  }
  const amountCheck = validateCreditAmount(input.amount)
  if (!amountCheck.ok) return { ok: false, error: 'INVALID_AMOUNT' }

  const actorUserId = walletPrincipalActorId(input.principal)

  return prisma.$transaction(async (tx) => {
    const auth = await assertWalletMutationAuthorized(tx, {
      principal: input.principal,
      operation: 'FUND',
      billingGroupId: input.billingGroupId,
      at: new Date(),
    })
    if (!auth.ok) return auth

    const wallet = await tx.creditWallet.findUnique({
      where: { billingGroupId_creditType: { billingGroupId: input.billingGroupId, creditType: 'MESSAGING' } },
    })
    if (!wallet) return { ok: false, error: 'WALLET_NOT_FOUND' }
    const existing = await tx.walletLedgerEntry.findUnique({ where: { idempotencyKey: input.idempotencyKey } })
    if (existing) {
      return {
        ok: true,
        value: {
          id: existing.id,
          walletId: existing.walletId,
          customerAccountId: existing.customerAccountId,
          managedSiteId: existing.managedSiteId,
          campaignId: existing.campaignId,
          type: existing.type as WalletLedgerEntryRecord['type'],
          deltaCredits: existing.deltaCredits,
          priceVersion: existing.priceVersion,
          reservationId: existing.reservationId,
          providerRef: existing.providerRef,
          originalLedgerEntryId: existing.originalLedgerEntryId,
          refundReason: existing.refundReason,
          idempotencyKey: existing.idempotencyKey,
          effectiveAt: existing.effectiveAt,
          actorUserId: existing.actorUserId,
        },
      }
    }
    await lockWalletRow(tx, wallet.id)
    const entry = await tx.walletLedgerEntry.create({
      data: {
        walletId: wallet.id,
        type: 'TOP_UP',
        deltaCredits: input.amount,
        priceVersion: 'wallet09-synthetic-test-only',
        providerRef: 'synthetic-test:vitest-fixture',
        idempotencyKey: input.idempotencyKey,
        actorUserId,
      },
    })
    await tx.creditWallet.update({ where: { id: wallet.id }, data: { ledgerSequence: { increment: 1 } } })
    return {
      ok: true,
      value: {
        id: entry.id,
        walletId: entry.walletId,
        customerAccountId: entry.customerAccountId,
        managedSiteId: entry.managedSiteId,
        campaignId: entry.campaignId,
        type: entry.type as WalletLedgerEntryRecord['type'],
        deltaCredits: entry.deltaCredits,
        priceVersion: entry.priceVersion,
        reservationId: entry.reservationId,
        providerRef: entry.providerRef,
        originalLedgerEntryId: entry.originalLedgerEntryId,
        refundReason: entry.refundReason,
        idempotencyKey: entry.idempotencyKey,
        effectiveAt: entry.effectiveAt,
        actorUserId: entry.actorUserId,
      },
    }
  })
}

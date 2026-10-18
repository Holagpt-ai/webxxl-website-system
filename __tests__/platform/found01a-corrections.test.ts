import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { activateFundingMembership, findActiveFundingConflict } from '@/lib/platform/billing-membership'
import {
  ABMED_AESTHETICS_ACCOUNT_ID,
  ABMED_GROUP_ID,
  ABMED_USAGE_OPERATOR_ID,
  BILLING_OWNER_USER_ID,
  CLINICAL_ONLY_USER_ID,
  createSyntheticAbmedFoundation,
} from '@/lib/platform/fixtures/abmed'
import { nextId } from '@/lib/platform/wallet/in-memory-store'
import {
  computeWalletBalance,
  createWalletContractService,
  expireHeldReservations,
  reservationOpenHoldAmount,
  seedWalletTopUp,
} from '@/lib/platform/wallet/service'
import { validateCreditAmount } from '@/lib/platform/wallet/validation'

describe('FOUND-01A partial reservation holds', () => {
  it('keeps unsettled credits held after partial settlement (1000 reserve 500 settle 100 => available 500)', () => {
    const store = createSyntheticAbmedFoundation()
    const wallet = createWalletContractService(store)
    seedWalletTopUp(store, ABMED_GROUP_ID, 1000, 'topup-partial', BILLING_OWNER_USER_ID)
    const reserved = wallet.reserve({
      actorUserId: ABMED_USAGE_OPERATOR_ID,
      billingGroupId: ABMED_GROUP_ID,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      amount: 500,
      correlationId: 'partial-500',
      idempotencyKey: 'hold-partial-500',
      expiresAt: new Date('2026-12-31T00:00:00.000Z'),
    })
    expect(reserved.ok).toBe(true)
    if (!reserved.ok) return
    const settled = wallet.settle({
      actorUserId: BILLING_OWNER_USER_ID,
      reservationId: reserved.value.id,
      amount: 100,
      idempotencyKey: 'settle-partial-100',
    })
    expect(settled.ok).toBe(true)
    const balance = wallet.getBalance(BILLING_OWNER_USER_ID, ABMED_GROUP_ID)
    expect(balance).toMatchObject({
      ok: true,
      value: { postedBalance: 900, reservedBalance: 400, availableBalance: 500 },
    })
    expect(reserved.value.status).toBe('PARTIALLY_SETTLED')
    expect(reservationOpenHoldAmount(reserved.value, new Date('2026-11-01T00:00:00.000Z'))).toBe(400)
    const secondHold = wallet.reserve({
      actorUserId: ABMED_USAGE_OPERATOR_ID,
      billingGroupId: ABMED_GROUP_ID,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      amount: 501,
      correlationId: 'blocked-by-hold',
      idempotencyKey: 'hold-blocked',
      expiresAt: new Date('2026-12-31T00:00:00.000Z'),
    })
    expect(secondHold).toEqual({ ok: false, error: 'INSUFFICIENT_CREDITS' })
    const allowedSecond = wallet.reserve({
      actorUserId: ABMED_USAGE_OPERATOR_ID,
      billingGroupId: ABMED_GROUP_ID,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      amount: 500,
      correlationId: 'allowed-within-available',
      idempotencyKey: 'hold-allowed-500',
      expiresAt: new Date('2026-12-31T00:00:00.000Z'),
    })
    expect(allowedSecond.ok).toBe(true)
  })

  it('supports multiple settlements, release, expiration, and idempotent replay', () => {
    const store = createSyntheticAbmedFoundation()
    const wallet = createWalletContractService(store)
    seedWalletTopUp(store, ABMED_GROUP_ID, 1000, 'topup-multi', BILLING_OWNER_USER_ID)
    const reserved = wallet.reserve({
      actorUserId: ABMED_USAGE_OPERATOR_ID,
      billingGroupId: ABMED_GROUP_ID,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      amount: 500,
      correlationId: 'multi',
      idempotencyKey: 'hold-multi',
      expiresAt: new Date('2026-12-31T00:00:00.000Z'),
    })
    expect(reserved.ok).toBe(true)
    if (!reserved.ok) return
    wallet.settle({
      actorUserId: BILLING_OWNER_USER_ID,
      reservationId: reserved.value.id,
      amount: 100,
      idempotencyKey: 'settle-a',
    })
    wallet.settle({
      actorUserId: BILLING_OWNER_USER_ID,
      reservationId: reserved.value.id,
      amount: 50,
      idempotencyKey: 'settle-b',
    })
    expect(reserved.value.status).toBe('PARTIALLY_SETTLED')
    const replay = wallet.settle({
      actorUserId: BILLING_OWNER_USER_ID,
      reservationId: reserved.value.id,
      amount: 100,
      idempotencyKey: 'settle-a',
    })
    expect(replay.ok).toBe(true)
    const released = wallet.release({
      actorUserId: BILLING_OWNER_USER_ID,
      reservationId: reserved.value.id,
      idempotencyKey: 'release-multi',
    })
    expect(released.ok).toBe(true)
    if (released.ok) expect(released.value.status).toBe('RELEASED')
    const expiredStore = createSyntheticAbmedFoundation()
    const expiredWallet = createWalletContractService(expiredStore)
    seedWalletTopUp(expiredStore, ABMED_GROUP_ID, 500, 'topup-expire', BILLING_OWNER_USER_ID)
    const expiring = expiredWallet.reserve({
      actorUserId: ABMED_USAGE_OPERATOR_ID,
      billingGroupId: ABMED_GROUP_ID,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      amount: 200,
      correlationId: 'expire-me',
      idempotencyKey: 'hold-expire',
      expiresAt: new Date('2026-01-01T00:00:00.000Z'),
    })
    expect(expiring.ok).toBe(true)
    expireHeldReservations(expiredStore, new Date('2026-02-01T00:00:00.000Z'))
    const w = expiredStore.wallets.values().next().value
    if (!w) throw new Error('wallet missing')
    const balance = computeWalletBalance(expiredStore, w, new Date('2026-02-01T00:00:00.000Z'))
    expect(balance.availableBalance).toBe(500)
  })
})

describe('FOUND-01A authorization and amount validation', () => {
  it('rejects invalid amounts and separates account usage from billing privileges', () => {
    expect(validateCreditAmount(0)).toEqual({ ok: false, reason: 'INVALID_AMOUNT' })
    expect(validateCreditAmount(-5)).toEqual({ ok: false, reason: 'INVALID_AMOUNT' })
    expect(validateCreditAmount(1.5)).toEqual({ ok: false, reason: 'INVALID_AMOUNT' })
    expect(validateCreditAmount(Number.NaN)).toEqual({ ok: false, reason: 'INVALID_AMOUNT' })

    const store = createSyntheticAbmedFoundation()
    const wallet = createWalletContractService(store)
    seedWalletTopUp(store, ABMED_GROUP_ID, 100, 'topup-auth', BILLING_OWNER_USER_ID)
    expect(
      wallet.reserve({
        actorUserId: BILLING_OWNER_USER_ID,
        billingGroupId: ABMED_GROUP_ID,
        customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
        amount: 10,
        correlationId: 'billing-only',
        idempotencyKey: 'hold-billing-only',
        expiresAt: new Date('2026-12-31T00:00:00.000Z'),
      }),
    ).toEqual({ ok: false, error: 'UNAUTHORIZED_SPEND' })
    expect(
      wallet.reserve({
        actorUserId: CLINICAL_ONLY_USER_ID,
        billingGroupId: ABMED_GROUP_ID,
        customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
        amount: 10,
        correlationId: 'wrong-account',
        idempotencyKey: 'hold-wrong-account',
        expiresAt: new Date('2026-12-31T00:00:00.000Z'),
      }),
    ).toEqual({ ok: false, error: 'UNAUTHORIZED_SPEND' })
    const reserved = wallet.reserve({
      actorUserId: ABMED_USAGE_OPERATOR_ID,
      billingGroupId: ABMED_GROUP_ID,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      amount: 10,
      correlationId: 'operator-ok',
      idempotencyKey: 'hold-operator',
      expiresAt: new Date('2026-12-31T00:00:00.000Z'),
    })
    expect(reserved.ok).toBe(true)
    if (!reserved.ok) return
    expect(
      wallet.settle({
        actorUserId: CLINICAL_ONLY_USER_ID,
        reservationId: reserved.value.id,
        amount: 10,
        idempotencyKey: 'settle-denied',
      }),
    ).toEqual({ ok: false, error: 'UNAUTHORIZED_SETTLE' })
  })
})

describe('FOUND-01A funding membership integrity', () => {
  it('detects conflicting active funding assignments for one customer account', () => {
    const store = createSyntheticAbmedFoundation()
    const at = new Date('2026-10-17T00:00:00.000Z')
    const extra = {
      id: nextId('bgm'),
      billingGroupId: 'group_other',
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      status: 'ACTIVE' as const,
      validFrom: at,
      validTo: null,
      authorizedByUserId: BILLING_OWNER_USER_ID,
      walletUseAllowed: true,
      spendingPolicyId: null,
      activeFundingKey: null,
    }
    const conflict = findActiveFundingConflict(store.memberships, extra, at)
    expect(conflict?.customerAccountId).toBe(ABMED_AESTHETICS_ACCOUNT_ID)
    store.memberships.push(extra)
    expect(activateFundingMembership(store.memberships, extra.id, at)).toEqual({
      ok: false,
      reason: 'ACTIVE_FUNDING_CONFLICT',
    })
  })
})

describe('FOUND-01A financial history preservation', () => {
  it('uses restrictive delete rules for immutable wallet artifacts in migration SQL', () => {
    const migration = readFileSync(
      path.join(process.cwd(), 'prisma/migrations/20261017220000_found01_platform_identity/migration.sql'),
      'utf8',
    )
    expect(migration).toContain('BillingGroupMembership_one_active_funding_per_account')
    expect(migration).toContain(
      'WalletLedgerEntry_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "CreditWallet"("id") ON DELETE RESTRICT',
    )
    expect(migration).toContain(
      'CreditReservation_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "CreditWallet"("id") ON DELETE RESTRICT',
    )
    expect(migration).toContain(
      'MessageUsage_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT',
    )
    expect(migration).not.toContain('WalletLedgerEntry_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "CreditWallet"("id") ON DELETE CASCADE')
  })
})

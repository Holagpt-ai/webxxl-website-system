import { describe, expect, it } from 'vitest'
import { activateFundingMembership } from '@/lib/platform/billing-membership'
import {
  ABMED_AESTHETICS_ACCOUNT_ID,
  ABMED_GROUP_ID,
  ABMED_USAGE_OPERATOR_ID,
  BILLING_OWNER_USER_ID,
  createSyntheticAbmedFoundation,
} from '@/lib/platform/fixtures/abmed'
import { resolveWalletActor } from '@/lib/platform/wallet/authorization'
import { nextId } from '@/lib/platform/wallet/in-memory-store'
import {
  createWalletContractService,
  expireHeldReservations,
  reservationAcceptsNewSettlement,
  seedWalletTopUp,
} from '@/lib/platform/wallet/service'

const TRUSTED_SETTLEMENT_SERVICE = 'service:webxxl-wallet-settlement'

describe('FOUND-01B trusted service actor authorization', () => {
  it('rejects forged SERVICE actors and allows registered internal services', () => {
    const store = createSyntheticAbmedFoundation()
    const wallet = createWalletContractService(store)
    seedWalletTopUp(store, ABMED_GROUP_ID, 100, 'topup-forge', BILLING_OWNER_USER_ID)

    expect(
      wallet.settle({
        actorUserId: 'attacker',
        actorType: 'SERVICE',
        reservationId: 'missing',
        amount: 1,
        idempotencyKey: 'forge-settle',
      }),
    ).toEqual({ ok: false, error: 'FORGED_SERVICE_ACTOR' })

    expect(resolveWalletActor(store, 'attacker', 'SERVICE')).toEqual({
      ok: false,
      error: 'FORGED_SERVICE_ACTOR',
    })

    store.trustedWalletServiceActors.add(TRUSTED_SETTLEMENT_SERVICE)
    expect(resolveWalletActor(store, TRUSTED_SETTLEMENT_SERVICE, 'SERVICE')).toMatchObject({
      ok: true,
      actor: { actorId: TRUSTED_SETTLEMENT_SERVICE, actorType: 'SERVICE' },
    })

    const reserved = wallet.reserve({
      actorUserId: ABMED_USAGE_OPERATOR_ID,
      billingGroupId: ABMED_GROUP_ID,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      amount: 40,
      correlationId: 'trusted-settle',
      idempotencyKey: 'hold-trusted',
      expiresAt: new Date('2026-12-31T00:00:00.000Z'),
    })
    expect(reserved.ok).toBe(true)
    if (!reserved.ok) return

    const forged = wallet.settle({
      actorUserId: TRUSTED_SETTLEMENT_SERVICE,
      actorType: 'SERVICE',
      reservationId: reserved.value.id,
      amount: 40,
      idempotencyKey: 'settle-forged-without-registry',
    })
    expect(forged.ok).toBe(true)

    store.trustedWalletServiceActors.delete(TRUSTED_SETTLEMENT_SERVICE)
    const reserved2 = wallet.reserve({
      actorUserId: ABMED_USAGE_OPERATOR_ID,
      billingGroupId: ABMED_GROUP_ID,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      amount: 10,
      correlationId: 'after-revoke',
      idempotencyKey: 'hold-after-revoke',
      expiresAt: new Date('2026-12-31T00:00:00.000Z'),
    })
    expect(reserved2.ok).toBe(true)
    if (!reserved2.ok) return
    expect(
      wallet.settle({
        actorUserId: TRUSTED_SETTLEMENT_SERVICE,
        actorType: 'SERVICE',
        reservationId: reserved2.value.id,
        amount: 10,
        idempotencyKey: 'settle-after-revoke',
      }),
    ).toEqual({ ok: false, error: 'FORGED_SERVICE_ACTOR' })
  })
})

describe('FOUND-01B membership activation atomicity', () => {
  it('does not mutate membership fields when active funding conflicts', () => {
    const store = createSyntheticAbmedFoundation()
    const at = new Date('2026-10-17T00:00:00.000Z')
    const pending: (typeof store.memberships)[number] = {
      id: nextId('bgm'),
      billingGroupId: 'group_other',
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      status: 'PENDING',
      validFrom: new Date('2026-09-01T00:00:00.000Z'),
      validTo: new Date('2026-09-15T00:00:00.000Z'),
      authorizedByUserId: BILLING_OWNER_USER_ID,
      walletUseAllowed: false,
      spendingPolicyId: null,
      activeFundingKey: null,
    }
    store.memberships.push(pending)

    const result = activateFundingMembership(store.memberships, pending.id, at)
    expect(result).toEqual({ ok: false, reason: 'ACTIVE_FUNDING_CONFLICT' })
    expect(pending).toMatchObject({
      status: 'PENDING',
      walletUseAllowed: false,
      validTo: new Date('2026-09-15T00:00:00.000Z'),
      activeFundingKey: null,
    })
  })
})

describe('FOUND-01B reservation expiration safety', () => {
  it('rejects already-expired reservations at creation', () => {
    const store = createSyntheticAbmedFoundation()
    const wallet = createWalletContractService(store)
    seedWalletTopUp(store, ABMED_GROUP_ID, 500, 'topup-exp-create', BILLING_OWNER_USER_ID)
    const at = new Date('2026-06-01T00:00:00.000Z')
    expect(
      wallet.reserve({
        actorUserId: ABMED_USAGE_OPERATOR_ID,
        billingGroupId: ABMED_GROUP_ID,
        customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
        amount: 100,
        correlationId: 'expired-at-create',
        idempotencyKey: 'hold-expired-create',
        expiresAt: new Date('2026-05-01T00:00:00.000Z'),
        at,
      }),
    ).toEqual({ ok: false, error: 'RESERVATION_EXPIRED' })
    expect(store.reservations).toHaveLength(0)
  })

  it('blocks settlement after expiry while preserving prior partial ledger debits', () => {
    const store = createSyntheticAbmedFoundation()
    const wallet = createWalletContractService(store)
    store.trustedWalletServiceActors.add(TRUSTED_SETTLEMENT_SERVICE)
    seedWalletTopUp(store, ABMED_GROUP_ID, 1000, 'topup-exp-settle', BILLING_OWNER_USER_ID)

    const reserved = wallet.reserve({
      actorUserId: ABMED_USAGE_OPERATOR_ID,
      billingGroupId: ABMED_GROUP_ID,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      amount: 500,
      correlationId: 'partial-then-expire',
      idempotencyKey: 'hold-partial-expire',
      expiresAt: new Date('2026-11-01T00:00:00.000Z'),
      at: new Date('2026-10-18T00:00:00.000Z'),
    })
    expect(reserved.ok).toBe(true)
    if (!reserved.ok) return

    const partial = wallet.settle({
      actorUserId: BILLING_OWNER_USER_ID,
      reservationId: reserved.value.id,
      amount: 100,
      idempotencyKey: 'settle-partial-before-expire',
    })
    expect(partial.ok).toBe(true)
    expect(reserved.value.settledAmount).toBe(100)
    expect(reserved.value.status).toBe('PARTIALLY_SETTLED')

    const afterExpiry = new Date('2026-12-01T00:00:00.000Z')
    expireHeldReservations(store, afterExpiry)
    expect(reserved.value.status).toBe('EXPIRED')
    expect(reservationAcceptsNewSettlement(reserved.value, afterExpiry)).toBe(false)

    expect(
      wallet.settle({
        actorUserId: BILLING_OWNER_USER_ID,
        reservationId: reserved.value.id,
        amount: 50,
        idempotencyKey: 'settle-after-expire',
      }),
    ).toEqual({ ok: false, error: 'RESERVATION_NOT_HELD' })

    const balance = wallet.getBalance(BILLING_OWNER_USER_ID, ABMED_GROUP_ID)
    expect(balance).toMatchObject({ ok: true, value: { postedBalance: 900, availableBalance: 900 } })
    expect(store.ledger.filter((entry) => entry.type === 'SETTLE')).toHaveLength(1)
  })

  it('rejects late settlement when hold expired but status was not yet marked EXPIRED', () => {
    const store = createSyntheticAbmedFoundation()
    const wallet = createWalletContractService(store)
    seedWalletTopUp(store, ABMED_GROUP_ID, 300, 'topup-late', BILLING_OWNER_USER_ID)
    const reserved = wallet.reserve({
      actorUserId: ABMED_USAGE_OPERATOR_ID,
      billingGroupId: ABMED_GROUP_ID,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      amount: 200,
      correlationId: 'late-settle',
      idempotencyKey: 'hold-late',
      expiresAt: new Date('2026-10-17T23:00:00.000Z'),
      at: new Date('2026-10-17T12:00:00.000Z'),
    })
    expect(reserved.ok).toBe(true)
    if (!reserved.ok) return
    expect(
      wallet.settle({
        actorUserId: BILLING_OWNER_USER_ID,
        reservationId: reserved.value.id,
        amount: 50,
        idempotencyKey: 'settle-late',
      }),
    ).toEqual({ ok: false, error: 'RESERVATION_EXPIRED' })
  })
})

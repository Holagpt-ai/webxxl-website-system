import { beforeAll, describe, expect, it } from 'vitest'
import { ABMED_AESTHETICS_ACCOUNT_ID, ABMED_GROUP_ID, ABMED_WALLET_ID } from '@/lib/platform/fixtures/abmed'
import { resolveVerifiedCommunicationQuoteCost } from '@/lib/platform/comms/quote-cost-snapshot'
import { isSyntheticServiceActorUserId } from '@/lib/platform/wallet/ledger-actor-attribution'
import {
  expireReservation,
  refundCredits,
  settleReservation,
} from '@/lib/platform/wallet/durable-service'
import { estimateMessagingCostFromQuotedUnits } from '@/lib/platform/wallet/rate-plan'
import { getPolicyPeriodStarts } from '@/lib/platform/wallet/spending-policy'
import { createMemoryWalletPrisma } from '@/lib/platform/wallet/test/memory-wallet-prisma'
import { enableWalletDurableTestExecution } from '@/lib/platform/wallet/test/wallet-test-execution'
import { seedSyntheticWalletTopUpForTests } from '@/lib/platform/wallet/test/synthetic-funding'
import { reserveCredits } from '@/lib/platform/wallet/durable-service'

const now = new Date('2026-10-18T15:00:00.000Z')
const SETTLE = { kind: 'SERVICE' as const, serviceId: 'wallet-settlement' as const }
const RESERVE = { kind: 'SERVICE' as const, serviceId: 'wallet-reservation' as const }
const EXPIRE = { kind: 'SERVICE' as const, serviceId: 'wallet-expiry' as const }

function db() {
  return createMemoryWalletPrisma({
    billingGroupId: ABMED_GROUP_ID,
    walletId: ABMED_WALLET_ID,
    memberships: [
      {
        billingGroupId: ABMED_GROUP_ID,
        customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
        status: 'ACTIVE',
        validFrom: new Date('2020-01-01'),
        validTo: null,
        walletUseAllowed: true,
      },
    ],
  })
}

describe('WALLET-09C database integrity', () => {
  beforeAll(() => {
    process.env.WALLET_SYNTHETIC_FUNDING_ENABLED = 'true'
    enableWalletDurableTestExecution()
  })

  it('A: SERVICE settlement stores actorServiceId not synthetic User FK', async () => {
    const { prisma, ledger } = db()
    await seedSyntheticWalletTopUpForTests(prisma, {
      billingGroupId: ABMED_GROUP_ID,
      amount: 100,
      idempotencyKey: 'fund_actor',
      principal: SETTLE,
    })
    const reserved = await reserveCredits(prisma, {
      principal: RESERVE,
      billingGroupId: ABMED_GROUP_ID,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      amount: 20,
      channel: 'SMS',
      correlationId: 'actor',
      idempotencyKey: 'res_actor',
      expiresAt: new Date(Date.now() + 3600_000),
      at: now,
    })
    expect(reserved.ok).toBe(true)
    if (!reserved.ok) return
    const settled = await settleReservation(prisma, {
      principal: SETTLE,
      reservationId: reserved.value.id,
      amount: 20,
      idempotencyKey: 'settle_actor',
    })
    expect(settled.ok).toBe(true)
    const entry = ledger.find((e) => e.idempotencyKey === 'settle_actor')
    expect(entry?.actorUserId).toBeNull()
    expect(entry?.actorServiceId).toBe('wallet-settlement')
    expect(isSyntheticServiceActorUserId(entry?.actorUserId)).toBe(false)
  })

  it('B: SERVICE refund actor attribution uses actorServiceId', async () => {
    const { prisma, ledger } = db()
    await seedSyntheticWalletTopUpForTests(prisma, {
      billingGroupId: ABMED_GROUP_ID,
      amount: 100,
      idempotencyKey: 'fund_ref_actor',
      principal: SETTLE,
    })
    const reserved = await reserveCredits(prisma, {
      principal: RESERVE,
      billingGroupId: ABMED_GROUP_ID,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      amount: 30,
      channel: 'SMS',
      correlationId: 'ref',
      idempotencyKey: 'res_ref_actor',
      expiresAt: new Date(Date.now() + 3600_000),
      at: now,
    })
    expect(reserved.ok).toBe(true)
    if (!reserved.ok) return
    const settled = await settleReservation(prisma, {
      principal: SETTLE,
      reservationId: reserved.value.id,
      amount: 30,
      idempotencyKey: 'settle_ref_actor',
    })
    expect(settled.ok).toBe(true)
    if (!settled.ok) return
    const refund = await refundCredits(prisma, {
      principal: SETTLE,
      walletId: ABMED_WALLET_ID,
      amount: 5,
      originalLedgerId: settled.value.id,
      idempotencyKey: 'refund_actor',
    })
    expect(refund.ok).toBe(true)
    const entry = ledger.find((e) => e.idempotencyKey === 'refund_actor')
    expect(entry?.actorUserId).toBeNull()
    expect(entry?.actorServiceId).toBe('wallet-settlement')
  })

  it('C: memory simulator rejects service: prefix in actorUserId (User FK semantics)', async () => {
    const { prisma } = db()
    await expect(
      prisma.walletLedgerEntry.create({
        data: {
          walletId: ABMED_WALLET_ID,
          type: 'ADJUSTMENT',
          deltaCredits: 0,
          priceVersion: 'test',
          idempotencyKey: 'bad_fk',
          actorUserId: 'service:webxxl-wallet-settlement',
        },
      }),
    ).rejects.toMatchObject({ code: 'P2003' })
  })

  it('D: 200-recipient aggregate quote is not multiplied by recipientCount twice', () => {
    const estimate = estimateMessagingCostFromQuotedUnits({
      channel: 'SMS',
      providerKey: 'twilio',
      totalQuotedUnits: 200,
      rateVersion: 'wallet09-fixture-v1',
    })
    expect(estimate.ok).toBe(true)
    if (!estimate.ok) return
    expect(estimate.value.estimatedTotalCredits).toBe(400)
  })

  it('E: unverified quote pricing fails closed', () => {
    const denied = resolveVerifiedCommunicationQuoteCost({
      channel: 'SMS',
      purpose: 'TRANSACTIONAL',
      contentHash: 'abc',
      recipientCount: 10,
      eligibleCount: 10,
      estimatedUnits: 10,
      maxApprovedCredits: 100,
      ratePlanVersion: 'not-verified-rate',
      unitCostVersion: null,
      detail: { unitsPerRecipient: 1, totalEstimatedUnits: 10 },
    })
    expect(denied.ok).toBe(false)
  })

  it('F/G: settle before expire — fully settled reservation is not expired', async () => {
    const { prisma, reservations } = db()
    await seedSyntheticWalletTopUpForTests(prisma, {
      billingGroupId: ABMED_GROUP_ID,
      amount: 80,
      idempotencyKey: 'fund_exp',
      principal: SETTLE,
    })
    const expiresAt = new Date(Date.now() + 3600_000)
    const reserved = await reserveCredits(prisma, {
      principal: RESERVE,
      billingGroupId: ABMED_GROUP_ID,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      amount: 25,
      channel: 'SMS',
      correlationId: 'exp',
      idempotencyKey: 'res_exp',
      expiresAt,
      at: now,
    })
    expect(reserved.ok).toBe(true)
    if (!reserved.ok) return
    const settled = await settleReservation(prisma, {
      principal: SETTLE,
      reservationId: reserved.value.id,
      amount: 25,
      idempotencyKey: 'settle_exp',
    })
    expect(settled.ok).toBe(true)

    const expired = await expireReservation(prisma, reserved.value.id, EXPIRE, new Date(Date.now() + 7200_000))
    expect(expired.ok).toBe(true)
    if (!expired.ok) return
    expect(expired.value.status).toBe('SETTLED')
    expect(reservations.find((r) => r.id === reserved.value.id)?.status).toBe('SETTLED')
  })

  it('H: half-hour and 45-minute offset timezone midnights', () => {
    const kolkata = getPolicyPeriodStarts(new Date('2026-01-15T12:00:00.000Z'), 'Asia/Kolkata')
    expect(kolkata.ok).toBe(true)
    if (kolkata.ok) {
      expect(kolkata.dayStartUtc.toISOString()).toBe('2026-01-14T18:30:00.000Z')
    }
    const kathmandu = getPolicyPeriodStarts(new Date('2026-01-15T12:00:00.000Z'), 'Asia/Kathmandu')
    expect(kathmandu.ok).toBe(true)
    if (kathmandu.ok) {
      expect(kathmandu.dayStartUtc.toISOString()).toBe('2026-01-14T18:15:00.000Z')
    }
    const nySummer = getPolicyPeriodStarts(new Date('2026-07-01T12:00:00.000Z'), 'America/New_York')
    expect(nySummer.ok).toBe(true)
    if (nySummer.ok) {
      expect(nySummer.dayStartUtc.toISOString()).toBe('2026-07-01T04:00:00.000Z')
    }
  })
})

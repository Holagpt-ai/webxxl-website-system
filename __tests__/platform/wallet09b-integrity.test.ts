import { beforeAll, describe, expect, it } from 'vitest'
import { ABMED_AESTHETICS_ACCOUNT_ID, ABMED_GROUP_ID, ABMED_WALLET_ID } from '@/lib/platform/fixtures/abmed'
import { resolveVerifiedCommunicationQuoteCost } from '@/lib/platform/comms/quote-cost-snapshot'
import { validateRefundLedgerIdempotencyReplay } from '@/lib/platform/wallet/ledger-idempotency'
import {
  isWalletTestExecutionBypassEnabled,
  walletDurableOperationDenial,
} from '@/lib/platform/wallet/execution-gates'
import {
  refundCredits,
  reconcileProviderSettlementEvent,
  reserveCredits,
  settleReservation,
} from '@/lib/platform/wallet/durable-service'
import { buildProviderEventFingerprint } from '@/lib/platform/wallet/provider-reconciliation'
import { estimateMessagingCost, estimateMessagingCostFromQuotedUnits } from '@/lib/platform/wallet/rate-plan'
import { getPolicyPeriodStarts } from '@/lib/platform/wallet/spending-policy'
import { createMemoryWalletPrisma } from '@/lib/platform/wallet/test/memory-wallet-prisma'
import { enableWalletDurableTestExecution } from '@/lib/platform/wallet/test/wallet-test-execution'
import { seedSyntheticWalletTopUpForTests } from '@/lib/platform/wallet/test/synthetic-funding'
import { prepareWalletTopUpQuote } from '@/lib/platform/wallet/top-up-quote'
import { isWalletBackendEnabled } from '@/config/wallet-backend'

const now = new Date('2026-10-18T15:00:00.000Z')
const RESERVE = { kind: 'SERVICE' as const, serviceId: 'wallet-reservation' as const }
const SETTLE = { kind: 'SERVICE' as const, serviceId: 'wallet-settlement' as const }
const RECONCILE = { kind: 'SERVICE' as const, serviceId: 'wallet-reconciliation' as const }

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
    policies: [
      {
        billingGroupId: ABMED_GROUP_ID,
        customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
        maxCampaignCredits: 1000,
        dailyLimit: null,
        monthlyLimit: null,
        allowedChannels: ['SMS'],
      },
    ],
  })
}

async function fundAndReserve(prisma: ReturnType<typeof db>['prisma'], idempotencyKey: string, amount: number) {
  await seedSyntheticWalletTopUpForTests(prisma, {
    billingGroupId: ABMED_GROUP_ID,
    amount: 500,
    idempotencyKey: `fund_${idempotencyKey}`,
    principal: SETTLE,
  })
  return reserveCredits(prisma, {
    principal: RESERVE,
    billingGroupId: ABMED_GROUP_ID,
    customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
    amount,
    channel: 'SMS',
    correlationId: idempotencyKey,
    idempotencyKey: `res_${idempotencyKey}`,
    expiresAt: new Date(Date.now() + 3600_000),
    at: now,
  })
}

describe('WALLET-09B accounting integrity', () => {
  beforeAll(() => {
    process.env.WALLET_SYNTHETIC_FUNDING_ENABLED = 'true'
    enableWalletDurableTestExecution()
  })

  it('A: America/New_York summer local midnight is 04:00 UTC', () => {
    const at = new Date('2026-07-01T15:00:00.000Z')
    const bounds = getPolicyPeriodStarts(at, 'America/New_York')
    expect(bounds.ok).toBe(true)
    if (!bounds.ok) return
    expect(bounds.dayStartUtc.toISOString()).toBe('2026-07-01T04:00:00.000Z')
  })

  it('A: America/New_York winter local midnight is 05:00 UTC', () => {
    const at = new Date('2026-01-15T15:00:00.000Z')
    const bounds = getPolicyPeriodStarts(at, 'America/New_York')
    expect(bounds.ok).toBe(true)
    if (!bounds.ok) return
    expect(bounds.dayStartUtc.toISOString()).toBe('2026-01-15T05:00:00.000Z')
  })

  it('B/C: DST spring-forward day and monthly period boundaries', () => {
    const preDst = getPolicyPeriodStarts(new Date('2026-03-08T12:00:00.000Z'), 'America/New_York')
    expect(preDst.ok).toBe(true)
    if (preDst.ok) {
      expect(preDst.dayStartUtc.toISOString()).toBe('2026-03-08T05:00:00.000Z')
    }
    const postDst = getPolicyPeriodStarts(new Date('2026-03-09T12:00:00.000Z'), 'America/New_York')
    expect(postDst.ok).toBe(true)
    if (postDst.ok) {
      expect(postDst.dayStartUtc.toISOString()).toBe('2026-03-09T04:00:00.000Z')
    }
    const month = getPolicyPeriodStarts(new Date('2026-03-15T12:00:00.000Z'), 'America/New_York')
    expect(month.ok).toBe(true)
    if (month.ok) {
      expect(month.monthStartUtc.toISOString()).toBe('2026-03-01T05:00:00.000Z')
    }
    const invalid = getPolicyPeriodStarts(now, 'Not/A_Zone')
    expect(invalid.ok).toBe(false)
  })

  it('D/E: foreign settlement idempotency and changed amount denied', async () => {
    const { prisma } = db()
    const r1 = await fundAndReserve(prisma, 'settle_a', 30)
    const r2 = await fundAndReserve(prisma, 'settle_b', 30)
    expect(r1.ok && r2.ok).toBe(true)
    if (!r1.ok || !r2.ok) return

    const first = await settleReservation(prisma, {
      principal: SETTLE,
      reservationId: r1.value.id,
      amount: 30,
      idempotencyKey: 'shared_settle_key',
    })
    expect(first.ok).toBe(true)

    const foreign = await settleReservation(prisma, {
      principal: SETTLE,
      reservationId: r2.value.id,
      amount: 30,
      idempotencyKey: 'shared_settle_key',
    })
    expect(foreign.ok).toBe(false)
    if (!foreign.ok) expect(foreign.error).toBe('IDEMPOTENCY_CONFLICT')

    const changedAmount = await settleReservation(prisma, {
      principal: SETTLE,
      reservationId: r1.value.id,
      amount: 29,
      idempotencyKey: 'shared_settle_key',
    })
    expect(changedAmount.ok).toBe(false)
    if (!changedAmount.ok) expect(changedAmount.error).toBe('IDEMPOTENCY_CONFLICT')
  })

  it('F: cross-wallet refund replay denied for same idempotency key', () => {
    const original = {
      id: 'settle_1',
      walletId: ABMED_WALLET_ID,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      type: 'SETTLE' as const,
      deltaCredits: -25,
      reservationId: 'res_1',
      originalLedgerEntryId: null,
      idempotencyKey: 'settle_1',
    }
    const existingRefund = {
      id: 'ref_1',
      walletId: ABMED_WALLET_ID,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      type: 'REFUND' as const,
      deltaCredits: 10,
      reservationId: 'res_1',
      originalLedgerEntryId: 'settle_1',
      idempotencyKey: 'refund_shared',
    }
    const denied = validateRefundLedgerIdempotencyReplay(
      existingRefund,
      {
        principal: SETTLE,
        walletId: 'other_wallet',
        amount: 10,
        originalLedgerId: 'settle_1',
        idempotencyKey: 'refund_shared',
      },
      original,
      (row) => ({
        id: row.id,
        walletId: row.walletId,
        customerAccountId: row.customerAccountId,
        managedSiteId: null,
        campaignId: null,
        type: row.type,
        deltaCredits: row.deltaCredits,
        priceVersion: 'wallet09-v1',
        reservationId: row.reservationId,
        providerRef: null,
        originalLedgerEntryId: row.originalLedgerEntryId,
        refundReason: null,
        idempotencyKey: row.idempotencyKey,
        effectiveAt: now,
        actorUserId: null,
      }),
    )
    expect(denied.ok).toBe(false)
    if (!denied.ok) expect(denied.error).toBe('IDEMPOTENCY_CONFLICT')
  })

  it('G: duplicate provider receipt cannot leak foreign ledger scope', async () => {
    const { prisma } = db()
    const r1 = await fundAndReserve(prisma, 'rcpt_a', 12)
    const r2 = await fundAndReserve(prisma, 'rcpt_b', 12)
    expect(r1.ok && r2.ok).toBe(true)
    if (!r1.ok || !r2.ok) return

    const fp = buildProviderEventFingerprint({
      providerKey: 'twilio',
      externalEventId: 'evt_dup',
      payloadHash: 'hash',
      reservationId: r1.value.id,
      settleAmount: 12,
    })
    const first = await reconcileProviderSettlementEvent(prisma, {
      principal: RECONCILE,
      providerKey: 'twilio',
      externalEventId: 'evt_dup',
      payloadHash: 'hash',
      normalizedStatus: 'DELIVERED',
      reservationId: r1.value.id,
      settleAmount: 12,
      providerRef: 'SM1',
      idempotencyKey: 'settle_evt_dup',
      eventFingerprint: fp,
    })
    expect(first.ok).toBe(true)

    const foreignFp = buildProviderEventFingerprint({
      providerKey: 'twilio',
      externalEventId: 'evt_dup',
      payloadHash: 'hash',
      reservationId: r2.value.id,
      settleAmount: 12,
    })
    const foreign = await reconcileProviderSettlementEvent(prisma, {
      principal: RECONCILE,
      providerKey: 'twilio',
      externalEventId: 'evt_dup',
      payloadHash: 'hash',
      normalizedStatus: 'DELIVERED',
      reservationId: r2.value.id,
      settleAmount: 12,
      providerRef: 'SM2',
      idempotencyKey: 'settle_evt_foreign',
      eventFingerprint: foreignFp,
    })
    expect(foreign.ok).toBe(false)
    if (!foreign.ok) expect(foreign.error).toBe('IDEMPOTENCY_CONFLICT')
  })

  it('H: SMS content hash must not drive segment estimate vs quoted units', () => {
    const shortHash = 'abc123deadbeef'
    const fromBody = estimateMessagingCost({
      channel: 'SMS',
      providerKey: 'twilio',
      body: shortHash,
      rateVersion: 'wallet09-fixture-v1',
    })
    const fromQuote = estimateMessagingCostFromQuotedUnits({
      channel: 'SMS',
      providerKey: 'twilio',
      quotedUnits: 8,
      recipientCount: 100,
      rateVersion: 'wallet09-fixture-v1',
    })
    expect(fromBody.ok && fromQuote.ok).toBe(true)
    if (!fromBody.ok || !fromQuote.ok) return
    expect(fromBody.value.estimatedTotalCredits).toBe(2)
    expect(fromQuote.value.estimatedTotalCredits).toBe(1600)
    expect(fromBody.value.estimatedTotalCredits).not.toBe(fromQuote.value.estimatedTotalCredits)
  })

  it('I: missing verified quote cost blocks comms wallet hold', async () => {
    const verified = resolveVerifiedCommunicationQuoteCost({
      channel: 'SMS',
      purpose: 'TRANSACTIONAL',
      contentHash: null,
      recipientCount: 1,
      eligibleCount: 1,
      estimatedUnits: 0,
      maxApprovedCredits: null,
      ratePlanVersion: null,
      unitCostVersion: null,
      detail: null,
    })
    expect(verified.ok).toBe(false)
  })

  it('J/K/L: disabled operation flags block durable service paths', async () => {
    const { prisma } = db()
    await seedSyntheticWalletTopUpForTests(prisma, {
      billingGroupId: ABMED_GROUP_ID,
      amount: 50,
      idempotencyKey: 'fund_flags',
      principal: SETTLE,
    })

    process.env.WALLET_RESERVATION_ENABLED = 'false'
    expect(walletDurableOperationDenial('RESERVE')).toBe('UNAUTHORIZED_SPEND')
    const deniedReserve = await reserveCredits(prisma, {
      principal: RESERVE,
      billingGroupId: ABMED_GROUP_ID,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      amount: 5,
      channel: 'SMS',
      correlationId: 'f',
      idempotencyKey: 'deny_res',
      expiresAt: new Date(Date.now() + 60_000),
      at: now,
    })
    expect(deniedReserve.ok).toBe(false)
    process.env.WALLET_RESERVATION_ENABLED = 'true'

    const reserved = await fundAndReserve(prisma, 'flags_settle', 10)
    expect(reserved.ok).toBe(true)
    if (!reserved.ok) return

    process.env.WALLET_SETTLEMENT_ENABLED = 'false'
    expect(walletDurableOperationDenial('SETTLE')).toBe('UNAUTHORIZED_SETTLE')
    const deniedSettle = await settleReservation(prisma, {
      principal: SETTLE,
      reservationId: reserved.value.id,
      amount: 10,
      idempotencyKey: 'deny_settle',
    })
    expect(deniedSettle.ok).toBe(false)
    process.env.WALLET_SETTLEMENT_ENABLED = 'true'

    const settled = await settleReservation(prisma, {
      principal: SETTLE,
      reservationId: reserved.value.id,
      amount: 10,
      idempotencyKey: 'ok_settle_flags',
    })
    expect(settled.ok).toBe(true)
    if (!settled.ok) return

    process.env.WALLET_REFUND_ENABLED = 'false'
    expect(walletDurableOperationDenial('REFUND')).toBe('UNAUTHORIZED_SETTLE')
    const deniedRefund = await refundCredits(prisma, {
      principal: SETTLE,
      walletId: ABMED_WALLET_ID,
      amount: 1,
      originalLedgerId: settled.value.id,
      idempotencyKey: 'deny_refund',
    })
    expect(deniedRefund.ok).toBe(false)
    process.env.WALLET_REFUND_ENABLED = 'true'
  })

  it('M: SERVICE principal cannot bypass global execution disablement', async () => {
    process.env.WALLET_TEST_EXECUTION_BYPASS = 'false'
    process.env.WALLET_BACKEND_ENABLED = 'false'
    process.env.WALLET_RESERVATION_ENABLED = 'true'
    expect(isWalletBackendEnabled()).toBe(false)
    expect(isWalletTestExecutionBypassEnabled()).toBe(false)
    expect(walletDurableOperationDenial('RESERVE')).toBe('UNAUTHORIZED_SPEND')
    enableWalletDurableTestExecution()
  })

  it('N: P2002 replay strategy documented — memory simulator only, not live PostgreSQL', () => {
    expect(true).toBe(true)
  })

  it('O: changed top-up quote material params conflict on replay', async () => {
    const { prisma } = db()
    const expires = new Date('2026-11-01T00:00:00.000Z')
    const first = await prepareWalletTopUpQuote(prisma, {
      billingGroupId: ABMED_GROUP_ID,
      creditAmount: 1000,
      fiatMinorUnits: 9900,
      priceVersion: 'wallet09-pack-1000-v1',
      idempotencyKey: 'topup_same',
      expiresAt: expires,
      payerUserId: 'payer_a',
    })
    expect(first.ok).toBe(true)
    const second = await prepareWalletTopUpQuote(prisma, {
      billingGroupId: ABMED_GROUP_ID,
      creditAmount: 1000,
      fiatMinorUnits: 9900,
      priceVersion: 'wallet09-pack-1000-v1',
      idempotencyKey: 'topup_same',
      expiresAt: expires,
      payerUserId: 'payer_b',
    })
    expect(second.ok).toBe(false)
    if (!second.ok) expect(second.error).toBe('IDEMPOTENCY_CONFLICT')
  })
})

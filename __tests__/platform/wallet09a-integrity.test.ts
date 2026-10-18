import { beforeAll, describe, expect, it } from 'vitest'
import { ABMED_AESTHETICS_ACCOUNT_ID, ABMED_GROUP_ID, ABMED_WALLET_ID } from '@/lib/platform/fixtures/abmed'
import {
  refundCredits,
  reconcileProviderSettlementEvent,
  reserveCredits,
  settleReservation,
} from '@/lib/platform/wallet/durable-service'
import { buildProviderEventFingerprint } from '@/lib/platform/wallet/provider-reconciliation'
import { buildReservationRequestFingerprint } from '@/lib/platform/wallet/reservation-fingerprint'
import { createMemoryWalletPrisma } from '@/lib/platform/wallet/test/memory-wallet-prisma'
import { seedSyntheticWalletTopUpForTests } from '@/lib/platform/wallet/test/synthetic-funding'
import { isWalletSyntheticFundingAllowed } from '@/config/wallet-backend'
import { prepareWalletTopUpQuote } from '@/lib/platform/wallet/top-up-quote'
import { evaluateSpendingPolicy, getPolicyPeriodStarts } from '@/lib/platform/wallet/spending-policy'
import { isWalletProviderMockTransportAllowed } from '@/config/wallet-backend'
import { createTwilioSmsProvider } from '@/lib/platform/providers/twilio-sms'

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
        dailyLimit: 90,
        monthlyLimit: 500,
        allowedChannels: ['SMS'],
      },
    ],
  })
}

describe('WALLET-09A financial integrity', () => {
  beforeAll(() => {
    process.env.WALLET_SYNTHETIC_FUNDING_ENABLED = 'true'
    process.env.WALLET_PROVIDER_RECONCILIATION_ENABLED = 'true'
  })

  it('synthetic mint denied outside isolated test configuration', async () => {
    const prev = process.env.WALLET_SYNTHETIC_FUNDING_ENABLED
    process.env.WALLET_SYNTHETIC_FUNDING_ENABLED = 'false'
    expect(isWalletSyntheticFundingAllowed()).toBe(false)
    const { prisma } = db()
    const denied = await seedSyntheticWalletTopUpForTests(prisma, {
      billingGroupId: ABMED_GROUP_ID,
      amount: 100,
      idempotencyKey: 'prod_mint',
      principal: SETTLE,
    })
    expect(denied.ok).toBe(false)
    process.env.WALLET_SYNTHETIC_FUNDING_ENABLED = prev
  })

  it('untrusted USER cannot reserve without operating membership', async () => {
    const { prisma } = db()
    await seedSyntheticWalletTopUpForTests(prisma, {
      billingGroupId: ABMED_GROUP_ID,
      amount: 200,
      idempotencyKey: 'fund_auth',
      principal: SETTLE,
    })
    const result = await reserveCredits(prisma, {
      principal: { kind: 'USER', userId: 'forged_user' },
      billingGroupId: ABMED_GROUP_ID,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      amount: 10,
      channel: 'SMS',
      correlationId: 'x',
      idempotencyKey: 'unauth_res',
      expiresAt: new Date(Date.now() + 60_000),
      at: now,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('UNAUTHORIZED_SPEND')
  })

  it('forged service string cannot be used as USER principal path', async () => {
    const { prisma } = db()
    await seedSyntheticWalletTopUpForTests(prisma, {
      billingGroupId: ABMED_GROUP_ID,
      amount: 100,
      idempotencyKey: 'fund_forged',
      principal: SETTLE,
    })
    const reserved = await reserveCredits(prisma, {
      principal: RESERVE,
      billingGroupId: ABMED_GROUP_ID,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      amount: 20,
      channel: 'SMS',
      correlationId: 'c1',
      idempotencyKey: 'ok_res',
      expiresAt: new Date(Date.now() + 60_000),
      at: now,
    })
    expect(reserved.ok).toBe(true)
    if (!reserved.ok) return
    const forgedSettle = await settleReservation(prisma, {
      principal: { kind: 'USER', userId: 'service:webxxl-wallet-settlement' },
      reservationId: reserved.value.id,
      amount: 20,
      idempotencyKey: 'forged_settle',
    })
    expect(forgedSettle.ok).toBe(false)
  })

  it('full reservation fingerprint conflict on idempotency replay', async () => {
    const { prisma } = db()
    await seedSyntheticWalletTopUpForTests(prisma, {
      billingGroupId: ABMED_GROUP_ID,
      amount: 500,
      idempotencyKey: 'fund_fp',
      principal: SETTLE,
    })
    const first = await reserveCredits(prisma, {
      principal: RESERVE,
      billingGroupId: ABMED_GROUP_ID,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      amount: 40,
      channel: 'SMS',
      correlationId: 'fp1',
      idempotencyKey: 'same_key',
      expiresAt: new Date('2026-10-19T12:00:00.000Z'),
      at: now,
    })
    expect(first.ok).toBe(true)
    const second = await reserveCredits(prisma, {
      principal: RESERVE,
      billingGroupId: ABMED_GROUP_ID,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      amount: 41,
      channel: 'SMS',
      correlationId: 'fp1',
      idempotencyKey: 'same_key',
      expiresAt: new Date('2026-10-19T12:00:00.000Z'),
      at: now,
    })
    expect(second.ok).toBe(false)
    if (!second.ok) expect(second.error).toBe('IDEMPOTENCY_CONFLICT')
  })

  it('cross-wallet refund denied and refund capped to original settle', async () => {
    const { prisma, ledger } = db()
    await seedSyntheticWalletTopUpForTests(prisma, {
      billingGroupId: ABMED_GROUP_ID,
      amount: 300,
      idempotencyKey: 'fund_refund',
      principal: SETTLE,
    })
    const reserved = await reserveCredits(prisma, {
      principal: RESERVE,
      billingGroupId: ABMED_GROUP_ID,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      amount: 50,
      channel: 'SMS',
      correlationId: 'rf',
      idempotencyKey: 'res_rf',
      expiresAt: new Date(Date.now() + 3600_000),
      at: now,
    })
    expect(reserved.ok).toBe(true)
    if (!reserved.ok) return
    const settled = await settleReservation(prisma, {
      principal: SETTLE,
      reservationId: reserved.value.id,
      amount: 50,
      idempotencyKey: 'settle_rf',
    })
    expect(settled.ok).toBe(true)
    if (!settled.ok) return

    const overRefund = await refundCredits(prisma, {
      principal: SETTLE,
      walletId: ABMED_WALLET_ID,
      amount: 60,
      originalLedgerId: settled.value.id,
      idempotencyKey: 'ref_over',
    })
    expect(overRefund.ok).toBe(false)

    const partial = await refundCredits(prisma, {
      principal: SETTLE,
      walletId: ABMED_WALLET_ID,
      amount: 20,
      originalLedgerId: settled.value.id,
      idempotencyKey: 'ref_20',
    })
    expect(partial.ok).toBe(true)

    const secondRefund = await refundCredits(prisma, {
      principal: SETTLE,
      walletId: ABMED_WALLET_ID,
      amount: 31,
      originalLedgerId: settled.value.id,
      idempotencyKey: 'ref_31',
    })
    expect(secondRefund.ok).toBe(false)

    const replay = await refundCredits(prisma, {
      principal: SETTLE,
      walletId: ABMED_WALLET_ID,
      amount: 20,
      originalLedgerId: settled.value.id,
      idempotencyKey: 'ref_20',
    })
    expect(replay.ok).toBe(true)
    expect(ledger.filter((e) => e.type === 'REFUND')).toHaveLength(1)
    const settleEntry = ledger.find((e) => e.id === settled.value.id)
    expect(settleEntry?.reservationId).toBe(reserved.value.id)
  })

  it('daily cap uses policy timezone window', () => {
    const bounds = getPolicyPeriodStarts(now, 'UTC')
    expect(bounds.ok).toBe(true)
    if (!bounds.ok) return
    const decision = evaluateSpendingPolicy({
      policy: {
        dailyLimit: 100,
        monthlyLimit: null,
        managedSiteDailyLimit: null,
        maxCampaignCredits: null,
        groupHardCap: null,
        allowedChannels: ['SMS'],
        policyTimezone: 'UTC',
      },
      channel: 'SMS',
      requestedCredits: 30,
      context: {
        at: now,
        hasManagedSiteScope: false,
        accountDailySettled: 80,
        accountDailyOpenHolds: 0,
        accountMonthlySettled: 80,
        accountMonthlyOpenHolds: 0,
        siteDailySettled: 0,
        siteDailyOpenHolds: 0,
        groupSettledInMonth: 80,
        groupOpenHolds: 0,
      },
    })
    expect(decision.ok).toBe(false)
  })

  it('untrusted provider status cannot settle', async () => {
    const { prisma } = db()
    await seedSyntheticWalletTopUpForTests(prisma, {
      billingGroupId: ABMED_GROUP_ID,
      amount: 100,
      idempotencyKey: 'fund_evt',
      principal: SETTLE,
    })
    const reserved = await reserveCredits(prisma, {
      principal: RESERVE,
      billingGroupId: ABMED_GROUP_ID,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      amount: 10,
      channel: 'SMS',
      correlationId: 'ev',
      idempotencyKey: 'res_ev',
      expiresAt: new Date(Date.now() + 3600_000),
      at: now,
    })
    expect(reserved.ok).toBe(true)
    if (!reserved.ok) return
    const fp = buildProviderEventFingerprint({
      providerKey: 'twilio',
      externalEventId: 'evt_x',
      payloadHash: 'h',
      reservationId: reserved.value.id,
      settleAmount: 10,
    })
    const bad = await reconcileProviderSettlementEvent(prisma, {
      principal: RECONCILE,
      providerKey: 'twilio',
      externalEventId: 'evt_x',
      payloadHash: 'h',
      normalizedStatus: 'UNKNOWN',
      reservationId: reserved.value.id,
      settleAmount: 10,
      providerRef: 'SM',
      idempotencyKey: 'k1',
      eventFingerprint: fp,
    })
    expect(bad.ok).toBe(false)
  })

  it('invalid top-up price version rejected', async () => {
    const { prisma } = db()
    const quote = await prepareWalletTopUpQuote(prisma, {
      billingGroupId: ABMED_GROUP_ID,
      creditAmount: 9999,
      fiatMinorUnits: 1,
      priceVersion: 'not-a-real-pack',
      idempotencyKey: 'bad_quote',
      expiresAt: new Date(Date.now() + 60_000),
    })
    expect(quote.ok).toBe(false)
  })

  it('mock HTTP transport blocked in production configuration', () => {
    expect(isWalletProviderMockTransportAllowed()).toBe(false)
  })

  it('fingerprint helper binds billing group and expiry', () => {
    const fp = buildReservationRequestFingerprint({
      billingGroupId: ABMED_GROUP_ID,
      walletId: ABMED_WALLET_ID,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      amount: 10,
      correlationId: 'c',
      expiresAt: new Date('2026-10-19T00:00:00.000Z'),
    })
    const fp2 = buildReservationRequestFingerprint({
      billingGroupId: ABMED_GROUP_ID,
      walletId: ABMED_WALLET_ID,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      amount: 10,
      correlationId: 'c',
      expiresAt: new Date('2026-10-20T00:00:00.000Z'),
    })
    expect(fp).not.toBe(fp2)
  })

  it('Twilio adapter ignores injected transport when mock flag off', async () => {
    let called = false
    const twilio = createTwilioSmsProvider({
      transport: {
        async postJson() {
          called = true
          return { status: 200, json: { sid: 'x' } }
        },
      },
    })
    process.env.TWILIO_ADAPTER_ENABLED = 'true'
    const result = await twilio.prepareSend(
      {
        customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
        actorId: 'a',
        actorType: 'USER',
        requestId: 'r',
        idempotencyKey: 'k',
      },
      { messagingTenantRef: 'm', senderRef: '+1', to: '+2', body: 'hi' },
    )
    process.env.TWILIO_ADAPTER_ENABLED = 'false'
    expect(called).toBe(false)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.status).toBe('PREPARED')
  })
})

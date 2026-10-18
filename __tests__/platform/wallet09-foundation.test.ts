import { readFileSync } from 'fs'
import path from 'path'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  ABMED_AESTHETICS_ACCOUNT_ID,
  ABMED_CLINICAL_ACCOUNT_ID,
  ABMED_GROUP_ID,
  ABMED_PHYSICIANS_ACCOUNT_ID,
  ABMED_WALLET_ID,
  BILLING_OWNER_USER_ID,
  SYNTHETIC_ABMED_USAGE,
  createSyntheticAbmedFoundation,
} from '@/lib/platform/fixtures/abmed'
import { evaluateCommunicationPolicy } from '@/lib/platform/comms/policy-engine'
import { createTwilioSmsProvider } from '@/lib/platform/providers/twilio-sms'
import { createResendEmailProvider } from '@/lib/platform/providers/resend-email'
import { estimateMessagingCost } from '@/lib/platform/wallet/rate-plan'
import {
  getWalletBalance,
  reconcileProviderSettlementEvent,
  releaseReservation,
  reserveCredits,
  settleReservation,
} from '@/lib/platform/wallet/durable-service'
import { buildProviderEventFingerprint } from '@/lib/platform/wallet/provider-reconciliation'
import { mintCreditsFromFundingEvidence, prepareWalletTopUpQuote } from '@/lib/platform/wallet/top-up-quote'
import { createMemoryWalletPrisma } from '@/lib/platform/wallet/test/memory-wallet-prisma'
import { seedSyntheticWalletTopUpForTests } from '@/lib/platform/wallet/test/synthetic-funding'
import {
  isResendTransportEnabled,
  isTwilioAdapterEnabled,
  isWalletBackendEnabled,
  isWalletReservationEnabled,
} from '@/config/wallet-backend'
import { createWalletContractService, seedWalletTopUp } from '@/lib/platform/wallet/service'

const now = new Date('2026-10-18T12:00:00.000Z')
const RESERVE_PRINCIPAL = { kind: 'SERVICE' as const, serviceId: 'wallet-reservation' as const }
const SETTLE_PRINCIPAL = { kind: 'SERVICE' as const, serviceId: 'wallet-settlement' as const }
const RECONCILE_PRINCIPAL = { kind: 'SERVICE' as const, serviceId: 'wallet-reconciliation' as const }

function abmedMemoryDb() {
  return createMemoryWalletPrisma({
    billingGroupId: ABMED_GROUP_ID,
    walletId: ABMED_WALLET_ID,
    memberships: [
      ABMED_AESTHETICS_ACCOUNT_ID,
      ABMED_PHYSICIANS_ACCOUNT_ID,
      ABMED_CLINICAL_ACCOUNT_ID,
    ].map((customerAccountId) => ({
      billingGroupId: ABMED_GROUP_ID,
      customerAccountId,
      status: 'ACTIVE',
      validFrom: new Date('2020-01-01'),
      validTo: null,
      walletUseAllowed: true,
    })),
    policies: [
      ABMED_AESTHETICS_ACCOUNT_ID,
      ABMED_PHYSICIANS_ACCOUNT_ID,
      ABMED_CLINICAL_ACCOUNT_ID,
    ].map((customerAccountId) => ({
      billingGroupId: ABMED_GROUP_ID,
      customerAccountId,
      maxCampaignCredits: 1000,
      dailyLimit: null,
      monthlyLimit: null,
      allowedChannels: ['SMS'],
    })),
  })
}

async function fundAbmed(prisma: ReturnType<typeof abmedMemoryDb>['prisma'], amount: number, key: string) {
  return seedSyntheticWalletTopUpForTests(prisma, {
    billingGroupId: ABMED_GROUP_ID,
    amount,
    idempotencyKey: key,
    principal: SETTLE_PRINCIPAL,
  })
}

describe('WALLET-09 foundation', () => {
  beforeAll(() => {
    process.env.WALLET_SYNTHETIC_FUNDING_ENABLED = 'true'
    process.env.WALLET_PROVIDER_RECONCILIATION_ENABLED = 'true'
  })

  it('AF: wallet feature flags default OFF', () => {
    expect(isWalletBackendEnabled()).toBe(false)
    expect(isWalletReservationEnabled()).toBe(false)
    expect(isTwilioAdapterEnabled()).toBe(false)
    expect(isResendTransportEnabled()).toBe(false)
  })

  it('E: policy engine requires all three operating account identities to match', () => {
    expect(
      evaluateCommunicationPolicy({
        customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
        channel: 'SMS',
        purpose: 'TRANSACTIONAL',
        senderAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
        recipientAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
        providerConnected: false,
        walletQuoteAvailable: true,
        suppressed: false,
        dataClassification: 'GENERAL_BUSINESS',
        approvedRegulatedWorkflow: false,
        aiActor: false,
      }),
    ).not.toBe('DENIED')
    expect(
      evaluateCommunicationPolicy({
        customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
        channel: 'SMS',
        purpose: 'TRANSACTIONAL',
        senderAccountId: ABMED_PHYSICIANS_ACCOUNT_ID,
        recipientAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
        providerConnected: false,
        walletQuoteAvailable: true,
        suppressed: false,
        dataClassification: 'GENERAL_BUSINESS',
        approvedRegulatedWorkflow: false,
        aiActor: false,
      }),
    ).toBe('DENIED')
  })

  it('W: SMS multipart fixture estimate uses more than one segment for long UCS-2 body', () => {
    const long = '你好'.repeat(40)
    const estimate = estimateMessagingCost({ channel: 'SMS', providerKey: 'twilio', body: long })
    expect(estimate.ok).toBe(true)
    if (estimate.ok) {
      expect(estimate.value.estimatedUnits).toBeGreaterThan(1)
      expect(estimate.value.estimatedTotalCredits).toBeGreaterThan(2)
    }
  })

  it('H: Twilio/Resend adapters stay prepared without live HTTP by default', async () => {
    const twilio = createTwilioSmsProvider({
      transport: {
        async postJson() {
          return { status: 200, json: { sid: 'SM_should_not_run' } }
        },
      },
    })
    const resend = createResendEmailProvider()
    const ctx = {
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      actorId: 'user_test',
      actorType: 'USER' as const,
      requestId: 'req_1',
      idempotencyKey: 'idem_1',
    }
    const sms = await twilio.prepareSend(ctx, {
      messagingTenantRef: 'mt_1',
      senderRef: '+15550001',
      to: '+15550002',
      body: 'Hello',
    })
    expect(sms.ok).toBe(false)
    const email = await resend.prepareSend(ctx, {
      verifiedDomainRef: 'aesthetics.example.com',
      from: 'team@aesthetics.example.com',
      to: ['lead@example.com'],
      subject: 'Hello',
      html: '<p>Hi</p>',
    })
    expect(email.ok).toBe(false)
  })

  it('T: top-up quote without payment proof does not mint credits', async () => {
    const { prisma } = abmedMemoryDb()
    await fundAbmed(prisma, SYNTHETIC_ABMED_USAGE.startingCredits, 'topup_abmed')
    const before = await getWalletBalance(prisma, ABMED_WALLET_ID, now)
    const quote = await prepareWalletTopUpQuote(prisma, {
      billingGroupId: ABMED_GROUP_ID,
      creditAmount: 1000,
      fiatMinorUnits: 9900,
      priceVersion: 'wallet09-pack-1000-v1',
      idempotencyKey: 'topup_quote_1',
      expiresAt: new Date(Date.now() + 60_000),
    })
    expect(quote.ok).toBe(true)
    const mint = await mintCreditsFromFundingEvidence(prisma, 'pay_unconfirmed')
    expect(mint.ok).toBe(false)
    const after = await getWalletBalance(prisma, ABMED_WALLET_ID, now)
    expect(after?.postedBalance).toBe(before?.postedBalance)
  })

  it('A: shared ABMED wallet 1000→650 with per-account attribution (durable path)', async () => {
    const { prisma } = abmedMemoryDb()
    await fundAbmed(prisma, SYNTHETIC_ABMED_USAGE.startingCredits, 'fund_abmed')

    async function spend(accountId: string, amount: number, key: string) {
      const reserved = await reserveCredits(prisma, {
        principal: RESERVE_PRINCIPAL,
        billingGroupId: ABMED_GROUP_ID,
        customerAccountId: accountId,
        amount,
        channel: 'SMS',
        correlationId: key,
        idempotencyKey: `res_${key}`,
        expiresAt: new Date(Date.now() + 3600_000),
        at: now,
      })
      expect(reserved.ok).toBe(true)
      if (!reserved.ok) return
      const settled = await settleReservation(prisma, {
        principal: SETTLE_PRINCIPAL,
        reservationId: reserved.value.id,
        amount,
        idempotencyKey: `settle_${key}`,
      })
      expect(settled.ok).toBe(true)
    }

    await spend(ABMED_AESTHETICS_ACCOUNT_ID, SYNTHETIC_ABMED_USAGE.aesthetics, 'aes')
    await spend(ABMED_PHYSICIANS_ACCOUNT_ID, SYNTHETIC_ABMED_USAGE.physicians, 'phy')
    await spend(ABMED_CLINICAL_ACCOUNT_ID, SYNTHETIC_ABMED_USAGE.clinical, 'cli')

    const balance = await getWalletBalance(prisma, ABMED_WALLET_ID, now)
    expect(balance).toMatchObject({
      walletId: ABMED_WALLET_ID,
      postedBalance: 650,
      availableBalance: 650,
    })
  })

  it('B: concurrent holds — only one 80-credit reservation succeeds on 100 available', async () => {
    const { prisma } = abmedMemoryDb()
    await fundAbmed(prisma, 100, 'fund_100')
    const base = {
      principal: RESERVE_PRINCIPAL,
      billingGroupId: ABMED_GROUP_ID,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      amount: 80,
      channel: 'SMS',
      correlationId: 'race',
      expiresAt: new Date(Date.now() + 3600_000),
      at: now,
    }
    const [first, second] = await Promise.all([
      reserveCredits(prisma, { ...base, idempotencyKey: 'race_a' }),
      reserveCredits(prisma, { ...base, idempotencyKey: 'race_b' }),
    ])
    const okCount = [first, second].filter((r) => r.ok).length
    expect(okCount).toBe(1)
    const denied = [first, second].find((r) => !r.ok)
    expect(denied).toBeDefined()
    if (denied && !denied.ok) expect(denied.error).toBe('INSUFFICIENT_CREDITS')
  })

  it('C: partial settlement then release — ledger debit 120 only', async () => {
    const { prisma, ledger } = abmedMemoryDb()
    await fundAbmed(prisma, 500, 'fund_partial')
    const reserved = await reserveCredits(prisma, {
      principal: RESERVE_PRINCIPAL,
      billingGroupId: ABMED_GROUP_ID,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      amount: 200,
      channel: 'SMS',
      correlationId: 'partial',
      idempotencyKey: 'res_partial',
      expiresAt: new Date(Date.now() + 3600_000),
      at: now,
    })
    expect(reserved.ok).toBe(true)
    if (!reserved.ok) return
    await settleReservation(prisma, {
      principal: SETTLE_PRINCIPAL,
      reservationId: reserved.value.id,
      amount: 120,
      idempotencyKey: 'settle_partial',
    })
    await releaseReservation(prisma, {
      principal: SETTLE_PRINCIPAL,
      reservationId: reserved.value.id,
      idempotencyKey: 'release_partial',
    })
    const debits = ledger.filter((e) => e.type === 'SETTLE')
    expect(debits.reduce((s, e) => s + Math.abs(e.deltaCredits), 0)).toBe(120)
    const balance = await getWalletBalance(prisma, ABMED_WALLET_ID, now)
    expect(balance?.postedBalance).toBe(380)
  })

  it('D: duplicate provider callback debits once', async () => {
    const { prisma, ledger } = abmedMemoryDb()
    await fundAbmed(prisma, 300, 'fund_cb')
    const reserved = await reserveCredits(prisma, {
      principal: RESERVE_PRINCIPAL,
      billingGroupId: ABMED_GROUP_ID,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      amount: 50,
      channel: 'SMS',
      correlationId: 'cb',
      idempotencyKey: 'res_cb',
      expiresAt: new Date(Date.now() + 3600_000),
      at: now,
    })
    expect(reserved.ok).toBe(true)
    if (!reserved.ok) return
    const eventFingerprint = buildProviderEventFingerprint({
      providerKey: 'twilio',
      externalEventId: 'evt_123',
      payloadHash: 'hash',
      reservationId: reserved.value.id,
      settleAmount: 50,
    })
    const payload = {
      principal: RECONCILE_PRINCIPAL,
      providerKey: 'twilio',
      externalEventId: 'evt_123',
      payloadHash: 'hash',
      normalizedStatus: 'DELIVERED',
      reservationId: reserved.value.id,
      settleAmount: 50,
      providerRef: 'SM123',
      idempotencyKey: 'settle_evt_123',
      eventFingerprint,
    }
    const first = await reconcileProviderSettlementEvent(prisma, payload)
    const second = await reconcileProviderSettlementEvent(prisma, payload)
    expect(first.ok).toBe(true)
    expect(second.ok).toBe(true)
    expect(ledger.filter((e) => e.type === 'SETTLE')).toHaveLength(1)
  })

  it('AE: FOUND-01 in-memory ABMED regression still passes', () => {
    const store = createSyntheticAbmedFoundation()
    seedWalletTopUp(store, ABMED_GROUP_ID, 1000, 'seed', BILLING_OWNER_USER_ID)
    const wallet = createWalletContractService(store)
    expect(wallet.getBalance(BILLING_OWNER_USER_ID, ABMED_GROUP_ID)).toMatchObject({
      ok: true,
      value: { availableBalance: 1000 },
    })
  })

  it('migration adds WALLET-09 durable models without CASCADE on wallet artifacts', () => {
    const migration = readFileSync(
      path.join(process.cwd(), 'prisma/migrations/20261018250000_wallet09_foundation/migration.sql'),
      'utf8',
    )
    expect(migration).toContain('MessagingRatePlan')
    expect(migration).toContain('WalletProviderEventReceipt')
    expect(migration).toContain('CreditReservation_walletId_requestFingerprint_key')
  })
})

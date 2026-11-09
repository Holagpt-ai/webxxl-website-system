import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PortalUser } from '@/lib/portal/authz'
import {
  ABMED_AESTHETICS_ACCOUNT_ID,
  ABMED_CLINICAL_ACCOUNT_ID,
  ABMED_GROUP_ID,
  ABMED_PHYSICIANS_ACCOUNT_ID,
  ABMED_WALLET_ID,
  SYNTHETIC_ABMED_USAGE,
} from '@/lib/platform/fixtures/abmed'
import { denyBillingGroupSiblingCommsAccess } from '@/lib/platform/comms/account-isolation'
import { authorizeOutboundCommunication } from '@/lib/platform/comms/outbound-authorization-gateway'
import { authorizeCommsWalletQuoteReservation } from '@/lib/platform/comms/wallet-quote-authorization'
import { evaluateChatwootDirectSendBypass } from '@/lib/platform/comms/policy-engine'
import { evaluateRegulatedWorkflowGate } from '@/lib/platform/comms/data-classification'
import {
  getWalletBalance,
  releaseReservation,
  reserveCredits,
  settleReservation,
} from '@/lib/platform/wallet/durable-service'
import { createMemoryWalletPrisma } from '@/lib/platform/wallet/test/memory-wallet-prisma'
import { seedSyntheticWalletTopUpForTests } from '@/lib/platform/wallet/test/synthetic-funding'
import { enableWalletDurableTestExecution } from '@/lib/platform/wallet/test/wallet-test-execution'
import { reconcileCommsWalletAgainstDispatchOutcome } from '@/lib/platform/comms-execution/wallet-reconcile-bridge'

const chatwootMock = vi.hoisted(() => vi.fn())
const messagingMock = vi.hoisted(() => vi.fn())
const prismaMock = vi.hoisted(() => ({
  managedSite: { findFirst: vi.fn() },
  chatwootConversationMapping: { count: vi.fn(), groupBy: vi.fn() },
  chatwootInboxMapping: { findMany: vi.fn() },
  billingGroupMembership: { findFirst: vi.fn(), findMany: vi.fn() },
  creditWallet: { findUnique: vi.fn() },
  walletLedgerEntry: { findMany: vi.fn() },
  creditReservation: { findMany: vi.fn() },
}))

vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('@/lib/platform/comms/chatwoot-readiness-service', () => ({
  buildChatwootIntegrationReadiness: chatwootMock,
}))
vi.mock('@/lib/platform/comms/messaging-provider-readiness', () => ({
  buildMessagingProviderReadiness: messagingMock,
}))
vi.mock('@/lib/platform/open001/load-subscriber-evidence', () => ({
  loadSubscriberEvidenceForAccount: vi.fn(async (customerAccountId: string) => ({
    customerAccountId,
    subscriptions:
      customerAccountId === ABMED_AESTHETICS_ACCOUNT_ID
        ? [{ customerAccountId, productKey: 'website.subscription', status: 'ACTIVE' }]
        : [],
    legacyWebsiteServices: [],
    loadOutcome: 'ok' as const,
  })),
}))

const RESERVE_PRINCIPAL = { kind: 'SERVICE' as const, serviceId: 'comms-gateway' as const }
const SETTLE_PRINCIPAL = { kind: 'SERVICE' as const, serviceId: 'wallet-settlement' as const }

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

function portalStub(accountId: string): PortalUser {
  return {
    id: 'user_1',
    role: 'CUSTOMER',
    membership: { role: 'OWNER', customerAccountId: accountId, userId: 'user_1' } as PortalUser['membership'],
    customerAccount: { id: accountId, businessName: 'Co' } as PortalUser['customerAccount'],
  } as PortalUser
}

const baseAuthInput = {
  customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
  actorUserId: 'staff-1',
  channel: 'SMS' as const,
  purpose: 'TRANSACTIONAL' as const,
  recipientAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
  consentStatus: 'GRANTED' as const,
  suppressed: false,
  senderIdentityId: 'sender-1',
  senderVerified: true,
  senderUseCaseRegistered: true,
  dataClassification: 'GENERAL_BUSINESS' as const,
  approvedRegulatedWorkflow: false,
  aiActor: false,
  providerConnected: true,
  walletQuoteAvailable: true,
  idempotencyKey: 'idem-batch4-1',
  contentFingerprint: 'fp-batch4-1',
  operatingMemberships: [{ userId: 'staff-1', customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID }],
  billingGroupSiblingAccounts: new Map([
    [ABMED_GROUP_ID, [ABMED_AESTHETICS_ACCOUNT_ID, ABMED_PHYSICIANS_ACCOUNT_ID, ABMED_CLINICAL_ACCOUNT_ID]],
  ]),
}

describe('Batch 4 — communications & messaging wallet', () => {
  const env = process.env

  beforeAll(() => {
    process.env.WALLET_SYNTHETIC_FUNDING_ENABLED = 'true'
    enableWalletDurableTestExecution()
  })

  beforeEach(() => {
    vi.resetModules()
    process.env = {
      ...env,
      COMMS_BACKEND_ENABLED: 'true',
      COMMS_INTEGRATION_GATES_ENABLED: 'true',
      COMMUNICATIONS_OUTBOUND_ENABLED: 'false',
      SMS_SEND_ENABLED: 'false',
      EMAIL_SEND_ENABLED: 'false',
      WALLET_COMMS_INTEGRATION_ENABLED: 'true',
      WALLET_BACKEND_ENABLED: 'true',
      OPEN001_FREE_SOFTWARE_COHORT: 'SUBSCRIBER_ONLY',
      WALLET_SYNTHETIC_FUNDING_ENABLED: 'true',
      WALLET_TEST_EXECUTION_BYPASS: 'true',
      WALLET_RESERVATION_ENABLED: 'true',
      WALLET_SETTLEMENT_ENABLED: 'true',
      WALLET_REFUND_ENABLED: 'true',
      WALLET_PROVIDER_RECONCILIATION_ENABLED: 'true',
    }
    chatwootMock.mockReset()
    messagingMock.mockReset()
    prismaMock.managedSite.findFirst.mockResolvedValue({ id: 'site_a' })
    prismaMock.chatwootConversationMapping.count.mockResolvedValue(2)
    prismaMock.chatwootConversationMapping.groupBy.mockResolvedValue([
      { externalInboxId: 'cw_inbox_1', _max: { lastSyncAt: new Date() } },
    ])
    prismaMock.chatwootInboxMapping.findMany.mockResolvedValue([
      {
        id: 'inbox_1',
        externalInboxId: 'cw_inbox_1',
        channelType: 'web',
        verificationState: 'VERIFIED',
        updatedAt: new Date(),
        tenantMapping: { verificationState: 'VERIFIED', revokedAt: null },
      },
    ])
    prismaMock.billingGroupMembership.findFirst.mockResolvedValue({ billingGroupId: ABMED_GROUP_ID })
    prismaMock.creditWallet.findUnique.mockResolvedValue({ id: ABMED_WALLET_ID })
    prismaMock.walletLedgerEntry.findMany.mockResolvedValue([{ deltaCredits: 1000 }])
    prismaMock.creditReservation.findMany.mockResolvedValue([])
    chatwootMock.mockResolvedValue({
      ok: true,
      value: {
        customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
        assessedAt: '2026-11-08T00:00:00.000Z',
        moduleEnabled: true,
        chatwootApiEnabled: false,
        webhookIngestEnabled: false,
        inboxCount: 1,
        verifiedInboxCount: 1,
        conversationMappingCount: 2,
        syncState: 'READY',
        dispatchBlockedMessage: 'Outbound blocked',
      },
    })
    messagingMock.mockResolvedValue({
      ok: true,
      value: {
        customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
        assessedAt: '2026-11-08T00:00:00.000Z',
        twilioAdapterEnabled: false,
        resendTransportEnabled: false,
        smsSendEnabled: false,
        emailSendEnabled: false,
        senders: [],
        liveDispatchBlocked: true as const,
      },
    })
  })

  afterEach(() => {
    process.env = env
    vi.unstubAllEnvs()
  })

  it('ABMED shared wallet: 1000 → 800 → 700 → 650 with account attribution', async () => {
    const { prisma } = abmedMemoryDb()
    await fundAbmed(prisma, SYNTHETIC_ABMED_USAGE.startingCredits, 'fund-batch4-start')

    const aesthetics = await reserveCredits(prisma, {
      principal: RESERVE_PRINCIPAL,
      billingGroupId: ABMED_GROUP_ID,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      amount: SYNTHETIC_ABMED_USAGE.aesthetics,
      correlationId: 'corr-aesthetics',
      idempotencyKey: 'reserve-aesthetics',
      expiresAt: new Date(Date.now() + 60_000),
      channel: 'SMS',
      usagePurpose: 'TRANSACTIONAL',
      rateVersion: 'wallet09-fixture-v1',
    })
    expect(aesthetics.ok).toBe(true)
    if (!aesthetics.ok) return
    await settleReservation(prisma, {
      principal: SETTLE_PRINCIPAL,
      reservationId: aesthetics.value.id,
      amount: SYNTHETIC_ABMED_USAGE.aesthetics,
      idempotencyKey: 'settle-aesthetics',
      providerRef: 'synthetic-aesthetics',
    })
    let balance = await getWalletBalance(prisma, ABMED_WALLET_ID)
    expect(balance?.availableBalance).toBe(SYNTHETIC_ABMED_USAGE.expectedAfterAesthetics)

    const physicians = await reserveCredits(prisma, {
      principal: RESERVE_PRINCIPAL,
      billingGroupId: ABMED_GROUP_ID,
      customerAccountId: ABMED_PHYSICIANS_ACCOUNT_ID,
      amount: SYNTHETIC_ABMED_USAGE.physicians,
      correlationId: 'corr-physicians',
      idempotencyKey: 'reserve-physicians',
      expiresAt: new Date(Date.now() + 60_000),
      channel: 'SMS',
      usagePurpose: 'TRANSACTIONAL',
      rateVersion: 'wallet09-fixture-v1',
    })
    expect(physicians.ok).toBe(true)
    if (!physicians.ok) return
    await settleReservation(prisma, {
      principal: SETTLE_PRINCIPAL,
      reservationId: physicians.value.id,
      amount: SYNTHETIC_ABMED_USAGE.physicians,
      idempotencyKey: 'settle-physicians',
      providerRef: 'synthetic-physicians',
    })
    balance = await getWalletBalance(prisma, ABMED_WALLET_ID)
    expect(balance?.availableBalance).toBe(SYNTHETIC_ABMED_USAGE.expectedAfterPhysicians)

    const clinical = await reserveCredits(prisma, {
      principal: RESERVE_PRINCIPAL,
      billingGroupId: ABMED_GROUP_ID,
      customerAccountId: ABMED_CLINICAL_ACCOUNT_ID,
      amount: SYNTHETIC_ABMED_USAGE.clinical,
      correlationId: 'corr-clinical',
      idempotencyKey: 'reserve-clinical',
      expiresAt: new Date(Date.now() + 60_000),
      channel: 'SMS',
      usagePurpose: 'TRANSACTIONAL',
      rateVersion: 'wallet09-fixture-v1',
    })
    expect(clinical.ok).toBe(true)
    if (!clinical.ok) return
    await settleReservation(prisma, {
      principal: SETTLE_PRINCIPAL,
      reservationId: clinical.value.id,
      amount: SYNTHETIC_ABMED_USAGE.clinical,
      idempotencyKey: 'settle-clinical',
      providerRef: 'synthetic-clinical',
    })
    balance = await getWalletBalance(prisma, ABMED_WALLET_ID)
    expect(balance?.availableBalance).toBe(SYNTHETIC_ABMED_USAGE.expectedAfterClinical)

    expect(aesthetics.value.originAccountId).toBe(ABMED_AESTHETICS_ACCOUNT_ID)
    expect(physicians.value.originAccountId).toBe(ABMED_PHYSICIANS_ACCOUNT_ID)
    expect(clinical.value.originAccountId).toBe(ABMED_CLINICAL_ACCOUNT_ID)
  })

  it('concurrent reservations + duplicate settle callback protection + insufficient funds', async () => {
    const { prisma } = abmedMemoryDb()
    await fundAbmed(prisma, 300, 'fund-batch4-concurrent')

    const [r1, r2] = await Promise.all([
      reserveCredits(prisma, {
        principal: RESERVE_PRINCIPAL,
        billingGroupId: ABMED_GROUP_ID,
        customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
        amount: 200,
        correlationId: 'corr-c1',
        idempotencyKey: 'reserve-c1',
        expiresAt: new Date(Date.now() + 60_000),
        rateVersion: 'wallet09-fixture-v1',
      }),
      reserveCredits(prisma, {
        principal: RESERVE_PRINCIPAL,
        billingGroupId: ABMED_GROUP_ID,
        customerAccountId: ABMED_PHYSICIANS_ACCOUNT_ID,
        amount: 100,
        correlationId: 'corr-c2',
        idempotencyKey: 'reserve-c2',
        expiresAt: new Date(Date.now() + 60_000),
        rateVersion: 'wallet09-fixture-v1',
      }),
    ])
    expect(r1.ok && r2.ok).toBe(true)
    if (!r1.ok || !r2.ok) return

    const insufficient = await reserveCredits(prisma, {
      principal: RESERVE_PRINCIPAL,
      billingGroupId: ABMED_GROUP_ID,
      customerAccountId: ABMED_CLINICAL_ACCOUNT_ID,
      amount: 50,
      correlationId: 'corr-c3',
      idempotencyKey: 'reserve-c3',
      expiresAt: new Date(Date.now() + 60_000),
      rateVersion: 'wallet09-fixture-v1',
    })
    expect(insufficient.ok).toBe(false)

    const settle1 = await settleReservation(prisma, {
      principal: SETTLE_PRINCIPAL,
      reservationId: r1.value.id,
      amount: 200,
      idempotencyKey: 'settle-c1',
      providerRef: 'prov-c1',
    })
    const settleDup = await settleReservation(prisma, {
      principal: SETTLE_PRINCIPAL,
      reservationId: r1.value.id,
      amount: 200,
      idempotencyKey: 'settle-c1',
      providerRef: 'prov-c1',
    })
    expect(settle1.ok).toBe(true)
    expect(settleDup.ok).toBe(true)
    if (settle1.ok && settleDup.ok) {
      expect(settleDup.value.id).toBe(settle1.value.id)
    }

    const released = await releaseReservation(prisma, {
      principal: SETTLE_PRINCIPAL,
      reservationId: r2.value.id,
      idempotencyKey: 'release-c2',
    })
    expect(released.ok).toBe(true)
  })

  it('comms→wallet reconcile bridge settles delivered and releases failed; unknown stays held', async () => {
    const { prisma } = abmedMemoryDb()
    await fundAbmed(prisma, 500, 'fund-batch4-reconcile')
    const held = await reserveCredits(prisma, {
      principal: RESERVE_PRINCIPAL,
      billingGroupId: ABMED_GROUP_ID,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      amount: 100,
      correlationId: 'corr-rec',
      idempotencyKey: 'reserve-rec',
      expiresAt: new Date(Date.now() + 60_000),
      rateVersion: 'wallet09-fixture-v1',
    })
    expect(held.ok).toBe(true)
    if (!held.ok) return

    const unknown = await reconcileCommsWalletAgainstDispatchOutcome(prisma, {
      reservationId: held.value.id,
      lifecycle: 'unknown',
      providerEventId: 'evt-unknown',
      providerRef: 'ref-unknown',
    })
    expect(unknown.ok).toBe(true)
    if (unknown.ok) expect(unknown.value.walletAction).toBe('RECONCILIATION_REQUIRED')

    const delivered = await reconcileCommsWalletAgainstDispatchOutcome(prisma, {
      reservationId: held.value.id,
      lifecycle: 'delivered',
      carrierDeliveryEvidence: true,
      providerEventId: 'evt-delivered',
      providerRef: 'ref-delivered',
      settleAmount: 100,
    })
    expect(delivered.ok).toBe(true)
    if (delivered.ok) expect(delivered.value.walletAction).toBe('SETTLED')

    const held2 = await reserveCredits(prisma, {
      principal: RESERVE_PRINCIPAL,
      billingGroupId: ABMED_GROUP_ID,
      customerAccountId: ABMED_PHYSICIANS_ACCOUNT_ID,
      amount: 50,
      correlationId: 'corr-fail',
      idempotencyKey: 'reserve-fail',
      expiresAt: new Date(Date.now() + 60_000),
      rateVersion: 'wallet09-fixture-v1',
    })
    expect(held2.ok).toBe(true)
    if (!held2.ok) return
    const failed = await reconcileCommsWalletAgainstDispatchOutcome(prisma, {
      reservationId: held2.value.id,
      lifecycle: 'failed',
      providerEventId: 'evt-failed',
      providerRef: 'ref-failed',
    })
    expect(failed.ok).toBe(true)
    if (failed.ok) expect(failed.value.walletAction).toBe('RELEASED')
  })

  it('billing group does not grant sibling CRM/comms access; suppression and healthcare fail closed', () => {
    const siblingDenied = denyBillingGroupSiblingCommsAccess({
      actorUserId: 'staff-1',
      operatingAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      recordAccountId: ABMED_PHYSICIANS_ACCOUNT_ID,
      operatingMemberships: [{ userId: 'staff-1', customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID }],
      billingGroupSiblingAccounts: baseAuthInput.billingGroupSiblingAccounts,
    })
    expect(siblingDenied.ok).toBe(false)

    const suppressed = authorizeOutboundCommunication({
      ...baseAuthInput,
      suppressed: true,
    })
    expect(suppressed.ok).toBe(true)
    if (suppressed.ok) expect(suppressed.value.policyDecision).toBe('DENIED')

    const healthcare = evaluateRegulatedWorkflowGate({
      dataClassification: 'REGULATED_HEALTHCARE',
      channel: 'SMS',
      approvedVendorWorkflow: false,
    })
    expect(healthcare).toBe('COMPLIANCE_REVIEW_REQUIRED')

    expect(evaluateChatwootDirectSendBypass()).not.toBe('ALLOW_PREPARATION')
  })

  it('wallet quote authorization enforces operating account + insufficient funds', () => {
    const ok = authorizeCommsWalletQuoteReservation({
      operatingAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      quoteCustomerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      billingGroupId: ABMED_GROUP_ID,
      authorizedBillingGroupIds: [ABMED_GROUP_ID],
      siblingCustomerAccountIds: [ABMED_PHYSICIANS_ACCOUNT_ID],
      availableCredits: 1000,
      requiredCredits: 200,
      ratePlanVersion: 'wallet09-fixture-v1',
      estimatedUnits: 100,
    })
    expect(ok.ok).toBe(true)

    const cross = authorizeCommsWalletQuoteReservation({
      operatingAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      quoteCustomerAccountId: ABMED_PHYSICIANS_ACCOUNT_ID,
      billingGroupId: ABMED_GROUP_ID,
      authorizedBillingGroupIds: [ABMED_GROUP_ID],
      siblingCustomerAccountIds: [ABMED_PHYSICIANS_ACCOUNT_ID],
      availableCredits: 1000,
      requiredCredits: 200,
      ratePlanVersion: 'wallet09-fixture-v1',
      estimatedUnits: 100,
    })
    expect(cross.ok).toBe(false)

    const insufficient = authorizeCommsWalletQuoteReservation({
      operatingAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      quoteCustomerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      billingGroupId: ABMED_GROUP_ID,
      authorizedBillingGroupIds: [ABMED_GROUP_ID],
      siblingCustomerAccountIds: [],
      availableCredits: 50,
      requiredCredits: 200,
      ratePlanVersion: 'wallet09-fixture-v1',
      estimatedUnits: 100,
    })
    expect(insufficient.ok).toBe(false)
    if (!insufficient.ok) expect(insufficient.message).toContain('INSUFFICIENT')
  })

  it('execution summary assembles readiness slices and stays preparation-only', async () => {
    const { getCommunicationsExecutionSummary } = await import('@/lib/platform/comms-execution/service')
    const summary = await getCommunicationsExecutionSummary({
      portal: portalStub(ABMED_AESTHETICS_ACCOUNT_ID),
      managedSiteId: 'site_a',
    })
    expect(summary.ok).toBe(true)
    if (!summary.ok) return
    expect(summary.value.dispatchPolicy.status).toBe('AVAILABLE')
    if (summary.value.dispatchPolicy.status === 'AVAILABLE') {
      expect(summary.value.dispatchPolicy.data.dispatchBlocked).toBe(true)
      expect(summary.value.dispatchPolicy.data.chatwootNativeSendBlocked).toBe(true)
    }
    expect(summary.value.walletGroupBoundary.status).toBe('AVAILABLE')
    if (summary.value.walletGroupBoundary.status === 'AVAILABLE') {
      expect(summary.value.walletGroupBoundary.data.siblingCrmAccessGranted).toBe(false)
      expect(summary.value.walletGroupBoundary.data.billingGroupId).toBe(ABMED_GROUP_ID)
    }
    expect(summary.value.chatwootReadiness.status).toBe('AVAILABLE')
    expect(summary.value.messagingProviderReadiness.status).toBe('AVAILABLE')
  })

  it('contract doc exists and routes map to Batch 4 surfaces', () => {
    const contract = readFileSync(
      join(process.cwd(), 'docs/platform/docs/BATCH4-COMMS-MESSAGING-WALLET-API-CONTRACT.md'),
      'utf8',
    )
    expect(contract).toContain('/api/v1/communications/execution/summary')
    expect(contract).toContain('ADR')
    const route = readFileSync(
      join(process.cwd(), 'app/api/v1/communications/execution/summary/route.ts'),
      'utf8',
    )
    expect(route).toContain('getCommunicationsExecutionSummary')
  })
})

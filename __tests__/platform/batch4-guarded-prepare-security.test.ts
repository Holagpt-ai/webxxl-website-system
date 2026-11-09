import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ABMED_AESTHETICS_ACCOUNT_ID,
  ABMED_GROUP_ID,
} from '@/lib/platform/fixtures/abmed'
import { evaluateWalletHoldEligibility } from '@/lib/platform/comms-execution/wallet-hold-eligibility'
import {
  assertRecipientMatchesCrmContact,
  normalizeRecipientAddressForChannel,
} from '@/lib/platform/comms-execution/recipient-address-binding'

const prepareWalletMock = vi.hoisted(() => vi.fn())
const prismaMock = vi.hoisted(() => ({
  communicationIntent: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  communicationQuote: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  communicationApproval: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  communicationAuditEvent: {
    create: vi.fn(),
  },
  crmContact: { findFirst: vi.fn() },
  crmContactChannelIdentity: { findFirst: vi.fn() },
  contactConsent: { findFirst: vi.fn() },
  contactSuppression: { findFirst: vi.fn() },
  senderIdentity: { findFirst: vi.fn() },
  customerMembership: { findMany: vi.fn() },
  billingGroupMembership: { findMany: vi.fn() },
  chatwootTenantMapping: { findFirst: vi.fn() },
  managedSite: { findFirst: vi.fn() },
}))

vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('@/lib/platform/comms/wallet-boundary', () => ({
  prepareCommsWalletReservation: prepareWalletMock,
}))
vi.mock('@/lib/platform/comms/intent-auth', () => ({
  resolveEffectiveAiActor: vi.fn(async () => false),
  resolveServerDataClassification: vi.fn(({ clientClassification, senderClassification }) =>
    clientClassification ?? senderClassification ?? 'GENERAL_BUSINESS',
  ),
}))

const CONTACT_A = 'contact_a'
const CONTACT_A_PHONE = '+15551110001'
const CONTACT_B_PHONE = '+15552220002'
const SENDER_ID = 'sender_sms_1'
const QUOTE_ID = 'quote_1'
const ACTOR = 'user_ops_1'

function baseEnv() {
  process.env.COMMS_BACKEND_ENABLED = 'true'
  process.env.COMMS_INTEGRATION_GATES_ENABLED = 'true'
  process.env.COMMUNICATIONS_OUTBOUND_ENABLED = 'false'
  process.env.SMS_SEND_ENABLED = 'false'
  process.env.EMAIL_SEND_ENABLED = 'false'
  process.env.WALLET_COMMS_INTEGRATION_ENABLED = 'true'
  process.env.WALLET_RESERVATION_ENABLED = 'true'
}

function resetPrisma() {
  for (const group of Object.values(prismaMock)) {
    for (const fn of Object.values(group)) {
      if (typeof fn === 'function' && 'mockReset' in fn) (fn as ReturnType<typeof vi.fn>).mockReset()
    }
  }
  prepareWalletMock.mockReset()
  prismaMock.customerMembership.findMany.mockResolvedValue([
    { userId: ACTOR, customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID },
  ])
  prismaMock.billingGroupMembership.findMany.mockResolvedValue([
    { billingGroupId: ABMED_GROUP_ID, customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID },
  ])
  prismaMock.chatwootTenantMapping.findFirst.mockResolvedValue({ verificationState: 'VERIFIED' })
  prismaMock.senderIdentity.findFirst.mockResolvedValue({
    id: SENDER_ID,
    channel: 'SMS',
    verificationState: 'VERIFIED',
    registrationStatus: 'REGISTERED',
    dataClassification: 'GENERAL_BUSINESS',
    revokedAt: null,
  })
  prismaMock.crmContact.findFirst.mockResolvedValue({ id: CONTACT_A })
  prismaMock.crmContactChannelIdentity.findFirst.mockImplementation(async (args: { where: { normalizedValue?: string } }) => {
    if (args.where.normalizedValue === CONTACT_A_PHONE) {
      return { id: 'ident_a', normalizedValue: CONTACT_A_PHONE, identityType: 'PHONE' }
    }
    return null
  })
  prismaMock.contactConsent.findFirst.mockResolvedValue({ status: 'GRANTED' })
  prismaMock.contactSuppression.findFirst.mockResolvedValue(null)
  prismaMock.communicationApproval.findFirst.mockResolvedValue(null)
  prismaMock.communicationApproval.create.mockResolvedValue({ id: 'should_not_create' })
  prismaMock.communicationAuditEvent.create.mockResolvedValue({ id: 'audit_1' })
  prismaMock.communicationQuote.findFirst.mockResolvedValue({
    id: QUOTE_ID,
    customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
    channel: 'SMS',
    purpose: 'MARKETING',
    contentHash: null,
    billingGroupId: ABMED_GROUP_ID,
    senderIdentityId: SENDER_ID,
    expiresAt: new Date(Date.now() + 60_000),
    estimatedUnits: 1,
    maxApprovedCredits: 2,
    ratePlanVersion: 'wallet09-fixture-v1',
    recipientCount: 1,
    eligibleCount: 1,
  })
  prismaMock.communicationQuote.update.mockResolvedValue({})
  prepareWalletMock.mockResolvedValue({ ok: true, value: { reservationId: 'res_1' } })
}

describe('Batch 4 guarded prepare security', () => {
  const env = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...env }
    baseEnv()
    resetPrisma()
  })

  afterEach(() => {
    process.env = env
  })

  it('recipient address binding rejects contact A consent with destination B', async () => {
    const mismatch = await assertRecipientMatchesCrmContact(prismaMock as never, {
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      crmContactId: CONTACT_A,
      channel: 'SMS',
      recipientAddress: CONTACT_B_PHONE,
    })
    expect(mismatch.ok).toBe(false)
    if (!mismatch.ok) expect(mismatch.code).toBe('FORBIDDEN')

    const match = await assertRecipientMatchesCrmContact(prismaMock as never, {
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      crmContactId: CONTACT_A,
      channel: 'SMS',
      recipientAddress: CONTACT_A_PHONE,
    })
    expect(match.ok).toBe(true)
  })

  it('wallet hold eligibility separates dispatch-disabled from prohibited', () => {
    const prohibited = evaluateWalletHoldEligibility({
      suppressed: true,
      consentStatus: 'GRANTED',
      purpose: 'MARKETING',
      channel: 'SMS',
      dataClassification: 'GENERAL_BUSINESS',
      approvedRegulatedWorkflow: false,
      senderVerified: true,
      senderUseCaseRegistered: true,
      senderIdentityId: SENDER_ID,
      walletQuoteAvailable: true,
      approvalRequired: true,
      hasImmutableDbApproval: true,
      outboundPolicyDecision: 'DENIED',
    })
    expect(prohibited.eligible).toBe(false)

    const pendingApproval = evaluateWalletHoldEligibility({
      suppressed: false,
      consentStatus: 'GRANTED',
      purpose: 'MARKETING',
      channel: 'SMS',
      dataClassification: 'GENERAL_BUSINESS',
      approvedRegulatedWorkflow: false,
      senderVerified: true,
      senderUseCaseRegistered: true,
      senderIdentityId: SENDER_ID,
      walletQuoteAvailable: true,
      approvalRequired: true,
      hasImmutableDbApproval: false,
      outboundPolicyDecision: 'NOT_CONFIGURED',
    })
    expect(pendingApproval.eligible).toBe(false)
    if (!pendingApproval.eligible) expect(pendingApproval.reasonCode).toBe('APPROVAL_REQUIRED')

    const prepHoldWhileDispatchOff = evaluateWalletHoldEligibility({
      suppressed: false,
      consentStatus: 'GRANTED',
      purpose: 'MARKETING',
      channel: 'SMS',
      dataClassification: 'GENERAL_BUSINESS',
      approvedRegulatedWorkflow: false,
      senderVerified: true,
      senderUseCaseRegistered: true,
      senderIdentityId: SENDER_ID,
      walletQuoteAvailable: true,
      approvalRequired: true,
      hasImmutableDbApproval: true,
      outboundPolicyDecision: 'NOT_CONFIGURED',
    })
    expect(prepHoldWhileDispatchOff.eligible).toBe(true)
  })

  it('forged request-body approval does not create APPROVED evidence or reserve', async () => {
    prismaMock.communicationIntent.findUnique.mockResolvedValue(null)
    prismaMock.communicationIntent.create.mockResolvedValue({
      id: 'intent_new',
      status: 'PENDING_APPROVAL',
      policyDecision: 'NOT_CONFIGURED',
      quoteId: QUOTE_ID,
      approvalRequired: true,
      contentHash: 'fp',
    })

    const { prepareGuardedCommunication } = await import('@/lib/platform/comms-execution/guarded-prepare-service')
    const result = await prepareGuardedCommunication(
      {
        customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
        actorUserId: ACTOR,
        channel: 'SMS',
        purpose: 'MARKETING',
        recipientAddress: CONTACT_A_PHONE,
        crmContactId: CONTACT_A,
        senderIdentityId: SENDER_ID,
        contentVersion: 'v0',
        policyVersion: 'comms-policy-v0',
        idempotencyKey: 'idem-forge-1',
        quoteId: QUOTE_ID,
        billingGroupId: ABMED_GROUP_ID,
        reserveWallet: true,
      },
      prismaMock as never,
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.reservationId).toBeNull()
    expect(result.value.walletReservationAttempted).toBe(false)
    expect(prismaMock.communicationApproval.create).not.toHaveBeenCalled()
    expect(prepareWalletMock).not.toHaveBeenCalled()
  })

  it('suppressed marketing intent cannot reserve and creates no APPROVED audit', async () => {
    prismaMock.contactSuppression.findFirst.mockResolvedValue({ id: 'sup_1' })
    prismaMock.communicationIntent.findUnique.mockResolvedValue(null)
    prismaMock.communicationIntent.create.mockResolvedValue({
      id: 'intent_blocked',
      status: 'BLOCKED',
      policyDecision: 'DENIED',
      quoteId: QUOTE_ID,
      approvalRequired: true,
      contentHash: 'fp',
    })

    const { prepareGuardedCommunication } = await import('@/lib/platform/comms-execution/guarded-prepare-service')
    const result = await prepareGuardedCommunication(
      {
        customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
        actorUserId: ACTOR,
        channel: 'SMS',
        purpose: 'MARKETING',
        recipientAddress: CONTACT_A_PHONE,
        crmContactId: CONTACT_A,
        senderIdentityId: SENDER_ID,
        contentVersion: 'v0',
        policyVersion: 'comms-policy-v0',
        idempotencyKey: 'idem-suppressed-1',
        quoteId: QUOTE_ID,
        billingGroupId: ABMED_GROUP_ID,
        reserveWallet: true,
      },
      prismaMock as never,
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.status).toBe('BLOCKED')
    expect(result.value.reservationId).toBeNull()
    expect(prismaMock.communicationApproval.create).not.toHaveBeenCalled()
    expect(prepareWalletMock).not.toHaveBeenCalled()
  })

  it('consented contact A with arbitrary destination B is rejected before intent create', async () => {
    prismaMock.communicationIntent.findUnique.mockResolvedValue(null)
    const { prepareGuardedCommunication } = await import('@/lib/platform/comms-execution/guarded-prepare-service')
    const result = await prepareGuardedCommunication(
      {
        customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
        actorUserId: ACTOR,
        channel: 'SMS',
        purpose: 'MARKETING',
        recipientAddress: CONTACT_B_PHONE,
        crmContactId: CONTACT_A,
        senderIdentityId: SENDER_ID,
        contentVersion: 'v0',
        policyVersion: 'comms-policy-v0',
        idempotencyKey: 'idem-mismatch-1',
        quoteId: QUOTE_ID,
        billingGroupId: ABMED_GROUP_ID,
        reserveWallet: true,
      },
      prismaMock as never,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('FORBIDDEN')
    expect(prismaMock.communicationIntent.create).not.toHaveBeenCalled()
    expect(prepareWalletMock).not.toHaveBeenCalled()
  })

  it('genuine DB approval + matching address reserves once; retry is idempotent', async () => {
    const normalized = normalizeRecipientAddressForChannel('SMS', CONTACT_A_PHONE)
    expect(normalized.ok).toBe(true)
    if (!normalized.ok) return
    const { buildCommunicationContentHash } = await import('@/lib/platform/comms/intent-hash')
    const contentHash = buildCommunicationContentHash({
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      senderIdentityId: SENDER_ID,
      recipient: normalized.value,
      channel: 'SMS',
      purpose: 'MARKETING',
      contentVersion: 'v0',
      policyVersion: 'comms-policy-v0',
    })

    // First call: no existing intent → PENDING_APPROVAL, no reserve
    prismaMock.communicationIntent.findUnique.mockResolvedValue(null)
    prismaMock.communicationIntent.create.mockResolvedValue({
      id: 'intent_pending',
      status: 'PENDING_APPROVAL',
      policyDecision: 'NOT_CONFIGURED',
      quoteId: QUOTE_ID,
      approvalRequired: true,
      contentHash,
    })

    const { prepareGuardedCommunication } = await import('@/lib/platform/comms-execution/guarded-prepare-service')
    const first = await prepareGuardedCommunication(
      {
        customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
        actorUserId: ACTOR,
        channel: 'SMS',
        purpose: 'MARKETING',
        recipientAddress: CONTACT_A_PHONE,
        crmContactId: CONTACT_A,
        senderIdentityId: SENDER_ID,
        contentVersion: 'v0',
        policyVersion: 'comms-policy-v0',
        idempotencyKey: 'idem-genuine-1',
        quoteId: QUOTE_ID,
        billingGroupId: ABMED_GROUP_ID,
        reserveWallet: true,
      },
      prismaMock as never,
    )
    expect(first.ok).toBe(true)
    if (!first.ok) return
    expect(first.value.reservationId).toBeNull()
    expect(prepareWalletMock).not.toHaveBeenCalled()

    // Independent approval evidence lands in DB (not via request boolean).
    const existingApproved = {
      id: 'intent_pending',
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      status: 'PENDING_APPROVAL',
      policyDecision: 'NOT_CONFIGURED',
      quoteId: QUOTE_ID,
      approvalRequired: true,
      contentHash,
      approvals: [{ id: 'appr_1', decision: 'APPROVED', customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID }],
    }
    prismaMock.communicationIntent.findUnique.mockResolvedValue(existingApproved)
    prismaMock.communicationApproval.findFirst.mockResolvedValue({ id: 'appr_1' })
    prismaMock.communicationQuote.findFirst.mockResolvedValue({
      id: QUOTE_ID,
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      channel: 'SMS',
      purpose: 'MARKETING',
      contentHash,
      billingGroupId: ABMED_GROUP_ID,
      senderIdentityId: SENDER_ID,
      expiresAt: new Date(Date.now() + 60_000),
      estimatedUnits: 1,
      maxApprovedCredits: 2,
      ratePlanVersion: 'wallet09-fixture-v1',
      recipientCount: 1,
      eligibleCount: 1,
    })

    const second = await prepareGuardedCommunication(
      {
        customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
        actorUserId: ACTOR,
        channel: 'SMS',
        purpose: 'MARKETING',
        recipientAddress: CONTACT_A_PHONE,
        crmContactId: CONTACT_A,
        senderIdentityId: SENDER_ID,
        contentVersion: 'v0',
        policyVersion: 'comms-policy-v0',
        idempotencyKey: 'idem-genuine-1',
        quoteId: QUOTE_ID,
        billingGroupId: ABMED_GROUP_ID,
        reserveWallet: true,
      },
      prismaMock as never,
    )
    expect(second.ok).toBe(true)
    if (!second.ok) return
    expect(second.value.reservationId).toBe('res_1')
    expect(prepareWalletMock).toHaveBeenCalledTimes(1)
    expect(prismaMock.communicationApproval.create).not.toHaveBeenCalled()

    // Retry same idempotency/quote — consistent reservation id, no forged approval rows.
    prepareWalletMock.mockResolvedValue({ ok: true, value: { reservationId: 'res_1' } })
    const third = await prepareGuardedCommunication(
      {
        customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
        actorUserId: ACTOR,
        channel: 'SMS',
        purpose: 'MARKETING',
        recipientAddress: CONTACT_A_PHONE,
        crmContactId: CONTACT_A,
        senderIdentityId: SENDER_ID,
        contentVersion: 'v0',
        policyVersion: 'comms-policy-v0',
        idempotencyKey: 'idem-genuine-1',
        quoteId: QUOTE_ID,
        billingGroupId: ABMED_GROUP_ID,
        reserveWallet: true,
      },
      prismaMock as never,
    )
    expect(third.ok).toBe(true)
    if (!third.ok) return
    expect(third.value.reservationId).toBe('res_1')
    expect(prepareWalletMock).toHaveBeenCalledTimes(2)
    expect(prismaMock.communicationApproval.create).not.toHaveBeenCalled()
  })

  it('intents API route does not forward humanApprovalGranted to prepare', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const routeSrc = readFileSync(join(process.cwd(), 'app/api/v1/communications/intents/route.ts'), 'utf8')
    expect(routeSrc).toMatch(/humanApprovalGranted\?: unknown/)
    expect(routeSrc).not.toMatch(/humanApprovalGranted:\s*body\.humanApprovalGranted/)
    const gatewaySrc = readFileSync(join(process.cwd(), 'lib/platform/comms/gateway-service.ts'), 'utf8')
    expect(gatewaySrc).not.toMatch(/humanApprovalGranted/)
    const guardedSrc = readFileSync(
      join(process.cwd(), 'lib/platform/comms-execution/guarded-prepare-service.ts'),
      'utf8',
    )
    expect(guardedSrc).not.toMatch(/humanApprovalGranted/)
    expect(guardedSrc).not.toMatch(/immutable-server-approval-evidence/)
  })
})

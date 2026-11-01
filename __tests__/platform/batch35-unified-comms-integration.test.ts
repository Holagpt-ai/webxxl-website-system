import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ABMED_AESTHETICS_ACCOUNT_ID,
  ABMED_GROUP_ID,
  ABMED_PHYSICIANS_ACCOUNT_ID,
} from '@/lib/platform/fixtures/abmed'
import { denyBillingGroupSiblingCommsAccess } from '@/lib/platform/comms/account-isolation'
import { rejectCrossAccountIdentityMatch } from '@/lib/platform/comms/contact-resolution-service'
import {
  dispatchStatusLabelFromOutcome,
  mapMessagingProviderLifecycleToOutcome,
} from '@/lib/platform/comms/dispatch-reconcile-policy'
import { commsProviderDispatchBlocked } from '@/lib/platform/comms/execution-gates'
import { evaluateChatwootDirectSendBypass } from '@/lib/platform/comms/policy-engine'
import {
  authorizeOutboundCommunication,
  authorizeOutboundDispatchRetry,
} from '@/lib/platform/comms/outbound-authorization-gateway'
import { authorizeCommsWalletQuoteReservation } from '@/lib/platform/comms/wallet-quote-authorization'
import {
  buildWebhookEventDedupeKey,
  buildWebhookPayloadFingerprint,
  scopedExternalEventRef,
} from '@/lib/platform/comms/webhook-dedupe'

const baseAuthInput = {
  customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
  actorUserId: 'staff-1',
  channel: 'SMS' as const,
  purpose: 'MARKETING' as const,
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
  idempotencyKey: 'idem-1',
  contentFingerprint: 'fp-1',
  operatingMemberships: [{ userId: 'staff-1', customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID }],
  billingGroupSiblingAccounts: new Map([[ABMED_GROUP_ID, [ABMED_AESTHETICS_ACCOUNT_ID, ABMED_PHYSICIANS_ACCOUNT_ID]]]),
}

describe('Batch 35 — unified communications integration', () => {
  beforeEach(() => {
    vi.stubEnv('COMMS_BACKEND_ENABLED', 'true')
    vi.stubEnv('COMMS_INTEGRATION_GATES_ENABLED', 'true')
    vi.stubEnv('COMMUNICATIONS_OUTBOUND_ENABLED', 'false')
    vi.stubEnv('SMS_SEND_ENABLED', 'false')
    vi.stubEnv('EMAIL_SEND_ENABLED', 'false')
    vi.stubEnv('WALLET_COMMS_INTEGRATION_ENABLED', 'true')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('1 cross-tenant conversation denial', async () => {
    const denied = await rejectCrossAccountIdentityMatch({
      identityAccountId: ABMED_PHYSICIANS_ACCOUNT_ID,
      targetAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
    })
    expect(denied.ok).toBe(false)
    const auth = authorizeOutboundCommunication({
      ...baseAuthInput,
      attemptedCrossAccountConversation: true,
    })
    expect(auth.ok).toBe(false)
  })

  it('2 shared wallet billing group does not grant sibling CRM access', () => {
    const denied = denyBillingGroupSiblingCommsAccess({
      actorUserId: 'staff-1',
      operatingAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      recordAccountId: ABMED_PHYSICIANS_ACCOUNT_ID,
      operatingMemberships: [{ userId: 'staff-1', customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID }],
      billingGroupSiblingAccounts: baseAuthInput.billingGroupSiblingAccounts,
    })
    expect(denied.ok).toBe(false)
  })

  it('3 missing consent and suppressed contacts blocked', () => {
    const noConsent = authorizeOutboundCommunication({
      ...baseAuthInput,
      consentStatus: 'UNKNOWN',
    })
    expect(noConsent.ok).toBe(true)
    if (noConsent.ok) expect(noConsent.value.policyDecision).toBe('DENIED')
    const suppressed = authorizeOutboundCommunication({
      ...baseAuthInput,
      consentStatus: 'GRANTED',
      suppressed: true,
    })
    expect(suppressed.ok).toBe(true)
    if (suppressed.ok) expect(suppressed.value.policyDecision).toBe('DENIED')
  })

  it('4 invalid sender/domain and regulated content blocked', () => {
    const badSender = authorizeOutboundCommunication({
      ...baseAuthInput,
      senderVerified: false,
    })
    expect(badSender.ok).toBe(false)
    const badDomain = authorizeOutboundCommunication({
      ...baseAuthInput,
      channel: 'EMAIL',
      emailDomainVerified: false,
    })
    expect(badDomain.ok).toBe(false)
    const regulated = authorizeOutboundCommunication({
      ...baseAuthInput,
      dataClassification: 'REGULATED_HEALTHCARE',
    })
    expect(regulated.ok).toBe(true)
    if (regulated.ok) expect(regulated.value.policyDecision).toBe('COMPLIANCE_REVIEW_REQUIRED')
  })

  it('5 duplicate webhooks are idempotent via dedupe keys', () => {
    const body = '{"event":"message_created","account":{"id":1},"message":{"id":10}}'
    const fp = buildWebhookPayloadFingerprint(body)
    const ref = scopedExternalEventRef({ event: 'message_created', account: { id: 1 }, message: { id: 10 } }, fp)
    const keyA = buildWebhookEventDedupeKey({
      providerInstanceId: 'inst',
      externalAccountId: '1',
      eventType: 'message_created',
      externalEventRef: ref,
    })
    const keyB = buildWebhookEventDedupeKey({
      providerInstanceId: 'inst',
      externalAccountId: '1',
      eventType: 'message_created',
      externalEventRef: ref,
    })
    expect(keyA).toBe(keyB)
  })

  it('6 replay/retry cannot duplicate send when dispatch blocked', () => {
    const blocked = commsProviderDispatchBlocked()
    expect(blocked).not.toBeNull()
    const retry = authorizeOutboundDispatchRetry({
      priorDispatchStatus: 'BLOCKED',
      idempotencyKey: 'idem-1',
      sameFingerprint: true,
    })
    expect(retry.ok).toBe(true)
    if (retry.ok) expect(retry.value.allowRetry).toBe(false)
  })

  it('7 unknown delivery outcomes remain unresolved', () => {
    const unknown = mapMessagingProviderLifecycleToOutcome({ lifecycle: 'unknown' })
    expect(unknown.kind).toBe('RECONCILIATION_REQUIRED')
    const deliveredWithoutEvidence = mapMessagingProviderLifecycleToOutcome({ lifecycle: 'delivered' })
    expect(deliveredWithoutEvidence.kind).toBe('RECONCILIATION_REQUIRED')
    expect(dispatchStatusLabelFromOutcome(deliveredWithoutEvidence)).toBe('RECONCILIATION_REQUIRED')
  })

  it('8 live provider operations blocked by default', () => {
    const dispatchBlock = commsProviderDispatchBlocked()
    expect(dispatchBlock && !dispatchBlock.ok ? dispatchBlock.code : null).toBe('NOT_CONFIGURED')
    expect(evaluateChatwootDirectSendBypass()).toBe('NOT_CONFIGURED')
    const wallet = authorizeCommsWalletQuoteReservation({
      operatingAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      quoteCustomerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      billingGroupId: ABMED_GROUP_ID,
      authorizedBillingGroupIds: [ABMED_GROUP_ID],
      siblingCustomerAccountIds: [ABMED_PHYSICIANS_ACCOUNT_ID],
      availableCredits: 100,
      requiredCredits: 5,
      ratePlanVersion: 'v1',
      estimatedUnits: 1,
    })
    expect(wallet.ok).toBe(true)
    const insufficient = authorizeCommsWalletQuoteReservation({
      ...{
        operatingAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
        quoteCustomerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
        billingGroupId: ABMED_GROUP_ID,
        authorizedBillingGroupIds: [ABMED_GROUP_ID],
        siblingCustomerAccountIds: [ABMED_PHYSICIANS_ACCOUNT_ID],
        ratePlanVersion: 'v1',
        estimatedUnits: 1,
      },
      availableCredits: 1,
      requiredCredits: 50,
    })
    expect(insufficient.ok).toBe(false)
    if (!insufficient.ok) expect(insufficient.message).toContain('INSUFFICIENT_BALANCE')
  })
})

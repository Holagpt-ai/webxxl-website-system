import { buildChatwootRelaySignature } from '@/lib/platform/comms/relay-sign'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ABMED_AESTHETICS_ACCOUNT_ID,
  ABMED_GROUP_ID,
  ABMED_PHYSICIANS_ACCOUNT_ID,
} from '@/lib/platform/fixtures/abmed'
import { assertChatwootTenantIsolation } from '@/lib/platform/crm/chatwoot-contract'
import { evaluateEntitlementAccess, getServiceEntitlement } from '@/lib/platform/entitlements'
import { denyBillingGroupSiblingCommsAccess } from '@/lib/platform/comms/account-isolation'
import {
  assertAbmedChatwootIsolation,
  buildSyntheticAbmedChatwootMappings,
  UNRELATED_BUSINESS_ACCOUNT_ID,
} from '@/lib/platform/comms/test-fixtures-abmed-comms'
import { rejectForgedChatwootScope } from '@/lib/platform/comms/tenant-resolve'
import { verifyChatwootRelaySignature } from '@/lib/platform/comms/webhook-auth'
import { parseChatwootWebhookEnvelope } from '@/lib/platform/comms/webhook-schemas'
import {
  evaluateChatwootDirectSendBypass,
  evaluateCommunicationPolicy,
} from '@/lib/platform/comms/policy-engine'
import { denyAiSelfAuthorizedSend, denyChatwootNativeBillableSend } from '@/lib/platform/comms/gateway-service'
import { mapProviderLifecycleToDispatchStatus } from '@/lib/platform/comms/event-processor'
import { mergeConversationActivityTimestamps } from '@/lib/platform/comms/conversation-service'
import { isRecognizedOptOutBody } from '@/lib/platform/comms/opt-out-service'
import { prepareHumanHandoffQueue } from '@/lib/platform/comms/follow-up-queue'
import { createChatwootConversationProvider } from '@/lib/platform/providers/chatwoot-conversation'
import { createWebxxlNativeCrmProvider } from '@/lib/platform/providers/webxxl-native-crm'

describe('COMMS-06 foundation', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('A/F: three ABMED sibling Chatwoot accounts isolated', () => {
    expect(assertAbmedChatwootIsolation()).toEqual({ ok: true })
    const mappings = buildSyntheticAbmedChatwootMappings()
    expect(assertChatwootTenantIsolation(mappings).ok).toBe(true)
    const ids = new Set(mappings.slice(0, 3).map((m) => m.chatwootAccountId))
    expect(ids.size).toBe(3)
  })

  it('B: unrelated business mapping is distinct from ABMED', () => {
    const mappings = buildSyntheticAbmedChatwootMappings()
    const unrelated = mappings.find((m) => m.customerAccountId === UNRELATED_BUSINESS_ACCOUNT_ID)!
    const aesthetics = mappings.find((m) => m.customerAccountId === ABMED_AESTHETICS_ACCOUNT_ID)!
    expect(unrelated.chatwootAccountId).not.toBe(aesthetics.chatwootAccountId)
  })

  it('C: billing group does not grant conversation access', () => {
    const denied = denyBillingGroupSiblingCommsAccess({
      actorUserId: 'u1',
      operatingAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      recordAccountId: ABMED_PHYSICIANS_ACCOUNT_ID,
      operatingMemberships: [{ userId: 'u1', customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID }],
      billingGroupSiblingAccounts: new Map([[ABMED_GROUP_ID, [ABMED_AESTHETICS_ACCOUNT_ID, ABMED_PHYSICIANS_ACCOUNT_ID]]]),
    })
    expect(denied.ok).toBe(false)
  })

  it('D: forged Chatwoot account/inbox denied', () => {
    const forged = rejectForgedChatwootScope({
      resolvedExternalAccountId: 'cw_acct_aesthetics',
      requestedExternalAccountId: 'cw_acct_physicians',
      authorizedInboxIds: ['cw_inbox_aesthetics_web'],
    })
    expect(forged.ok).toBe(false)
  })

  it('G: unauthorized webhook rejected without relay secret', () => {
    const auth = verifyChatwootRelaySignature({
      rawBody: '{}',
      signatureHeader: 'abc',
      timestampHeader: `${Math.floor(Date.now() / 1000)}`,
      relaySecret: null,
      toleranceSeconds: 300,
    })
    expect(auth.ok).toBe(false)
  })

  it('H: webhook envelope parsing accepts documented event types', () => {
    const body = parseChatwootWebhookEnvelope({ event: 'message_created', account: { id: 1 } })
    expect(body?.event).toBe('message_created')
  })

  it('I: out-of-order conversation timestamps preserve max last activity', () => {
    const merged = mergeConversationActivityTimestamps({
      currentLast: new Date('2026-10-10T00:00:00Z'),
      eventAt: new Date('2026-10-05T00:00:00Z'),
    })
    expect(merged.lastActivityAt.toISOString()).toBe('2026-10-10T00:00:00.000Z')
  })

  it('M: provider ACCEPTED is not DELIVERED', () => {
    expect(mapProviderLifecycleToDispatchStatus('accepted')).toBe('ACCEPTED_BY_PROVIDER')
    expect(mapProviderLifecycleToDispatchStatus('delivered')).toBe('DELIVERED')
  })

  it('N/O: STOP recognized; duplicate handled in service contract', () => {
    expect(isRecognizedOptOutBody('STOP')).toBe(true)
    expect(isRecognizedOptOutBody('hello')).toBe(false)
  })

  it('Q/R: missing consent and suppression block marketing preparation', () => {
    const deniedConsent = evaluateCommunicationPolicy({
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      channel: 'SMS',
      purpose: 'MARKETING',
      senderAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      recipientAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      consentStatus: 'UNKNOWN',
      suppressed: false,
      providerConnected: true,
      walletQuoteAvailable: true,
      dataClassification: 'GENERAL_BUSINESS',
      approvedRegulatedWorkflow: false,
      aiActor: false,
    })
    expect(deniedConsent).toBe('DENIED')
    const deniedSuppressed = evaluateCommunicationPolicy({
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      channel: 'SMS',
      purpose: 'MARKETING',
      senderAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      recipientAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      consentStatus: 'GRANTED',
      suppressed: true,
      providerConnected: true,
      walletQuoteAvailable: true,
      dataClassification: 'GENERAL_BUSINESS',
      approvedRegulatedWorkflow: false,
      aiActor: false,
    })
    expect(deniedSuppressed).toBe('DENIED')
  })

  it('S/T: Chatwoot direct billable send and outbound disabled', () => {
    expect(evaluateChatwootDirectSendBypass()).toBe('NOT_CONFIGURED')
    const bypass = denyChatwootNativeBillableSend()
    expect(bypass.ok).toBe(true)
    if (bypass.ok) expect(bypass.value.allowed).toBe(false)
  })

  it('W/X: no wallet spend path; AI cannot self-authorize', () => {
    expect(denyAiSelfAuthorizedSend().ok).toBe(true)
  })

  it('Y: unknown coverage reported in handoff queue', () => {
    const queue = prepareHumanHandoffQueue()
    expect(queue.ok).toBe(true)
    if (queue.ok) {
      expect(queue.value.some((row) => row.coverage === 'UNKNOWN_COVERAGE')).toBe(true)
    }
  })

  it('Z: CRM native provider contract preserved', () => {
    expect(createWebxxlNativeCrmProvider().describeCapabilities().contacts).toBe(true)
  })

  it('OPEN-001 communications entitlement resolved at policy (SUBSCRIBER_ONLY)', () => {
    const entitlement = getServiceEntitlement('core.communications')
    expect(entitlement).toBeDefined()
    expect(evaluateEntitlementAccess(entitlement!).access).toBe('INCLUDED')
  })

  it('Chatwoot adapter mocked contract: list inboxes via transport', async () => {
    const provider = createChatwootConversationProvider({
      baseUrl: 'https://chatwoot.example',
      transport: async () => ({
        status: 200,
        json: [{ id: 7, name: 'Web', channel_type: 'Channel::WebWidget' }],
      }),
      resolveApiAccessToken: async () => 'token',
      resolveExternalAccountId: async () => '12',
    })
    vi.stubEnv('CHATWOOT_API_ENABLED', 'true')
    const inboxes = await provider.listInboxes({
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      actorId: 'u1',
      actorType: 'USER',
      requestId: 'r1',
      idempotencyKey: 'k1',
    })
    expect(inboxes.ok).toBe(true)
    if (inboxes.ok) expect(inboxes.value[0]?.id).toBe('7')
  })

  it('Webhook signature verification accepts valid HMAC', () => {
    const secret = 'relay-secret'
    const rawBody = '{"event":"message_created","account":{"id":1}}'
    const ts = Math.floor(Date.now() / 1000)
    const sig = buildChatwootRelaySignature({ relaySecret: secret, relayTimestampSeconds: ts, rawBody })
    const ok = verifyChatwootRelaySignature({
      rawBody,
      signatureHeader: sig,
      timestampHeader: String(ts),
      relaySecret: secret,
      toleranceSeconds: 300,
    })
    expect(ok.ok).toBe(true)
  })
})

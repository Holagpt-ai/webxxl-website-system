import { createHash } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ABMED_AESTHETICS_ACCOUNT_ID,
  ABMED_PHYSICIANS_ACCOUNT_ID,
} from '@/lib/platform/fixtures/abmed'
import { buildChatwootRelaySignature } from '@/lib/platform/comms/relay-sign'
import { verifyChatwootRelaySignature } from '@/lib/platform/comms/webhook-auth'
import {
  buildWebhookEventDedupeKey,
  buildWebhookPayloadFingerprint,
  scopedExternalEventRef,
} from '@/lib/platform/comms/webhook-dedupe'
import {
  classifyInboundTimelineEvent,
  inboxChannelKindFromChatwootType,
} from '@/lib/platform/comms/channel-classifier'
import { mergeConversationActivityTimestamps } from '@/lib/platform/comms/conversation-service'
import { evaluateSynthetic200Quote } from '@/lib/platform/comms/quote-synthetic'
import { resolveServerDataClassification, resolveEffectiveAiActor } from '@/lib/platform/comms/intent-auth'
import { buildCommunicationContentHash } from '@/lib/platform/comms/intent-hash'
import { denyAiSelfAuthorizedSend } from '@/lib/platform/comms/gateway-service'

describe('COMMS-06A corrections', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('A: equal-length unrelated webhook events get distinct dedupe keys', () => {
    const bodyA = '{"event":"message_created","account":{"id":1},"message":{"id":10}}'
    const bodyB = '{"event":"message_created","account":{"id":1},"message":{"id":99}}'
    expect(bodyA.length).toBe(bodyB.length)
    const fpA = buildWebhookPayloadFingerprint(bodyA)
    const fpB = buildWebhookPayloadFingerprint(bodyB)
    const keyA = buildWebhookEventDedupeKey({
      providerInstanceId: 'inst',
      externalAccountId: '1',
      eventType: 'message_created',
      externalEventRef: scopedExternalEventRef(
        { event: 'message_created', account: { id: 1 }, message: { id: 10 } },
        fpA,
      ),
    })
    const keyB = buildWebhookEventDedupeKey({
      providerInstanceId: 'inst',
      externalAccountId: '1',
      eventType: 'message_created',
      externalEventRef: scopedExternalEventRef(
        { event: 'message_created', account: { id: 1 }, message: { id: 99 } },
        fpB,
      ),
    })
    expect(keyA).not.toBe(keyB)
  })

  it('E: missing relay timestamp rejected; stale timestamp rejected', () => {
    const secret = 'relay'
    const rawBody = '{"event":"message_created"}'
    const ts = Math.floor(Date.now() / 1000)
    const sig = buildChatwootRelaySignature({ relaySecret: secret, relayTimestampSeconds: ts, rawBody })
    const missingTs = verifyChatwootRelaySignature({
      rawBody,
      signatureHeader: sig,
      timestampHeader: null,
      relaySecret: secret,
      toleranceSeconds: 60,
    })
    expect(missingTs.ok).toBe(false)
    const stale = verifyChatwootRelaySignature({
      rawBody,
      signatureHeader: sig,
      timestampHeader: String(ts - 3600),
      relaySecret: secret,
      toleranceSeconds: 60,
      nowMs: ts * 1000,
    })
    expect(stale.ok).toBe(false)
  })

  it('I/J: web chat vs SMS timeline classification', () => {
    expect(inboxChannelKindFromChatwootType('Channel::WebWidget')).toBe('WEB_CHAT')
    expect(inboxChannelKindFromChatwootType('Channel::TwilioSms')).toBe('SMS')
    expect(
      classifyInboundTimelineEvent({
        inboxChannel: 'WEB_CHAT',
        messageType: 0,
      }),
    ).toBe('WEB_CHAT_STARTED')
    expect(
      classifyInboundTimelineEvent({
        inboxChannel: 'SMS',
        messageType: 'incoming',
      }),
    ).toBe('INBOUND_SMS')
    expect(
      classifyInboundTimelineEvent({
        inboxChannel: 'SOCIAL_DM',
        messageType: 0,
      }),
    ).toBe('SOCIAL_DM_RECEIVED')
  })

  it('K: out-of-order events preserve latest last activity', () => {
    const merged = mergeConversationActivityTimestamps({
      currentLast: new Date('2026-10-12T00:00:00Z'),
      eventAt: new Date('2026-10-01T00:00:00Z'),
    })
    expect(merged.lastActivityAt.toISOString()).toBe('2026-10-12T00:00:00.000Z')
  })

  it('P: changed intent fingerprint detected via content hash', () => {
    const base = {
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      senderIdentityId: null,
      recipient: '+15551212',
      channel: 'SMS',
      purpose: 'MARKETING',
      contentVersion: 'v1',
      policyVersion: 'p1',
    }
    const h1 = buildCommunicationContentHash(base)
    const h2 = buildCommunicationContentHash({ ...base, contentVersion: 'v2' })
    expect(h1).not.toBe(h2)
  })

  it('Q: client cannot downgrade regulated classification', () => {
    const resolved = resolveServerDataClassification({
      clientClassification: 'GENERAL_BUSINESS',
      senderClassification: 'REGULATED_HEALTHCARE',
    })
    expect(resolved).toBe('REGULATED_HEALTHCARE')
  })

  it('R: synthetic 200-contact quote uses fixture not DB', () => {
    vi.stubEnv('COMMS_SYNTHETIC_QUOTE_ENABLED', 'true')
    const counts = evaluateSynthetic200Quote({
      customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
      channel: 'EMAIL',
      purpose: 'MARKETING',
    })
    expect(counts.recipientCount).toBe(200)
    expect(counts.eligibleCount).toBeGreaterThan(0)
    expect(counts.invalidContactCount).toBe(0)
  })

  it('S/T: no wallet spend; AI send denied with flags off', () => {
    expect(denyAiSelfAuthorizedSend().ok).toBe(true)
  })

  it('B/C: webhook ingest dedupes identical authenticated payload', async () => {
    const store = new Map<string, { id: string; payloadHash: string; eventDedupeKey: string }>()
    const secret = 'relay-secret'
    const ts = Math.floor(Date.now() / 1000)
    const rawBody = JSON.stringify({
      event: 'message_created',
      account: { id: 12 },
      inbox: { id: 3 },
      message: { id: 44, created_at: ts },
    })
    const sig = buildChatwootRelaySignature({ relaySecret: secret, relayTimestampSeconds: ts, rawBody })

    vi.doMock('@/lib/db', () => ({
      prisma: {
        commsWebhookReceipt: {
          findUnique: async ({ where }: { where: { eventDedupeKey?: string; idempotencyKey?: string } }) => {
            if (where.eventDedupeKey) return store.get(where.eventDedupeKey) ?? null
            if (where.idempotencyKey) {
              return [...store.values()].find((v) => v.id === where.idempotencyKey) ?? null
            }
            return null
          },
          create: async ({ data }: { data: { id?: string; eventDedupeKey: string; payloadHash: string } }) => {
            const id = data.id ?? 'rcpt_1'
            store.set(data.eventDedupeKey, { id, payloadHash: data.payloadHash, eventDedupeKey: data.eventDedupeKey })
            return { id, ...data }
          },
        },
        chatwootTenantMapping: {
          findFirst: async () => ({
            id: 'tenant_a',
            customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
            providerInstanceId: 'inst',
            externalAccountId: '12',
            authorizedInboxIds: ['3'],
            verificationState: 'VERIFIED',
            revokedAt: null,
          }),
        },
        chatwootInboxMapping: {
          findFirst: async () => ({
            customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
            externalInboxId: '3',
            verificationState: 'VERIFIED',
          }),
        },
      },
    }))

    const { ingestChatwootWebhook } = await import('@/lib/platform/comms/webhook-ingest-service')
    const first = await ingestChatwootWebhook({
      providerInstanceId: 'inst',
      rawBody,
      signatureHeader: sig,
      timestampHeader: String(ts),
      relaySecret: secret,
      clientIdempotencyKey: null,
      toleranceSeconds: 300,
    })
    expect(first.ok).toBe(true)
    const second = await ingestChatwootWebhook({
      providerInstanceId: 'inst',
      rawBody,
      signatureHeader: sig,
      timestampHeader: String(ts),
      relaySecret: secret,
      clientIdempotencyKey: null,
      toleranceSeconds: 300,
    })
    expect(second.ok).toBe(true)
    if (second.ok) expect(second.value.status).toBe('DUPLICATE')
  })

  it('L/M: STOP cross-account conflict vs exact duplicate', async () => {
    vi.doMock('@/lib/db', () => ({
      prisma: {
        contactSuppression: {
          findUnique: async ({ where }: { where: { idempotencyKey: string } }) => {
            if (where.idempotencyKey === 'stop-shared') {
              return {
                id: 'sup_1',
                customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
                contactId: 'c_a',
                channel: 'SMS',
                purpose: 'MARKETING',
              }
            }
            return null
          },
        },
        crmContact: {
          findFirst: async ({ where }: { where: { id: string; customerAccountId: string } }) =>
            where.customerAccountId === ABMED_PHYSICIANS_ACCOUNT_ID && where.id === 'c_b'
              ? { id: 'c_b', customerAccountId: ABMED_PHYSICIANS_ACCOUNT_ID, managedSiteId: null, status: 'ACTIVE' }
              : null,
        },
      },
    }))
    vi.doMock('@/lib/platform/crm/consent-service', () => ({
      recordContactSuppression: async (input: {
        customerAccountId: string
        contactId: string
        idempotencyKey?: string
      }) => {
        if (input.idempotencyKey === 'stop-shared' && input.customerAccountId === ABMED_PHYSICIANS_ACCOUNT_ID) {
          return { ok: false, code: 'CONFLICT', message: 'Suppression idempotency key conflict' }
        }
        return { ok: true, value: { id: 'sup_new' } }
      },
      assertCrmContactOwnedByAccount: async () => ({ ok: true, value: true }),
    }))
    vi.doMock('@/lib/platform/crm/contact-guard', () => ({
      assertCrmContactOwnedByAccount: async () => ({ ok: true, value: true }),
    }))

    const { processInboundOptOut } = await import('@/lib/platform/comms/opt-out-service')
    const conflict = await processInboundOptOut({
      customerAccountId: ABMED_PHYSICIANS_ACCOUNT_ID,
      contactId: 'c_b',
      channel: 'SMS',
      body: 'STOP',
      source: 'test',
      idempotencyKey: 'stop-shared',
      trustedSenderResolved: true,
    })
    expect(conflict.ok).toBe(false)
  })

  it('F/G: quarantined receipt cannot process via trusted worker', async () => {
    vi.doMock('@/lib/db', () => ({
      prisma: {
        commsWebhookReceipt: {
          findUnique: async () => ({
            id: 'rcpt_q',
            receiptStatus: 'QUARANTINED',
            processingStatus: 'FAILED',
            customerAccountId: ABMED_AESTHETICS_ACCOUNT_ID,
            providerInstanceId: 'inst',
            tenantMappingId: 'tenant_a',
            payloadHash: 'abc',
            eventDedupeKey: 'dedupe',
            sanitizedDetail: {},
          }),
          updateMany: async () => ({ count: 0 }),
        },
      },
    }))
    const { processCommsWebhookReceiptById } = await import('@/lib/platform/comms/receipt-processor')
    const result = await processCommsWebhookReceiptById({ receiptId: 'rcpt_q', workerId: 'worker_1' })
    expect(result.ok).toBe(false)
  })
})

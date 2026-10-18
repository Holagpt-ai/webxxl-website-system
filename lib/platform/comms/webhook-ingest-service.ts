import { prisma } from '@/lib/db'
import { COMMS_WEBHOOK_MAX_BODY_BYTES } from '@/config/comms-backend'
import { parseChatwootWebhookEnvelope, type ChatwootWebhookEnvelope } from '@/lib/platform/comms/webhook-schemas'
import { verifyChatwootRelaySignature } from '@/lib/platform/comms/webhook-auth'
import { resolveChatwootTenantByExternalAccount, assertInboxAuthorizedForTenant } from '@/lib/platform/comms/tenant-resolve'
import {
  buildWebhookEventDedupeKey,
  buildWebhookIdempotencyKey,
  buildWebhookPayloadFingerprint,
  scopedExternalEventRef,
} from '@/lib/platform/comms/webhook-dedupe'
import type { CommsResult } from '@/lib/platform/comms/types'

export async function ingestChatwootWebhook(input: {
  providerInstanceId: string
  rawBody: string
  signatureHeader: string | null
  timestampHeader: string | null
  relaySecret: string | null
  clientIdempotencyKey: string | null
  toleranceSeconds: number
}): Promise<
  CommsResult<{
    receiptId: string
    status: 'ACCEPTED' | 'DUPLICATE' | 'QUARANTINED'
    processingStatus: 'PENDING'
  }>
> {
  if (Buffer.byteLength(input.rawBody, 'utf8') > COMMS_WEBHOOK_MAX_BODY_BYTES) {
    return { ok: false, code: 'VALIDATION', message: 'Webhook body too large' }
  }

  let parsed: ChatwootWebhookEnvelope
  try {
    const json = JSON.parse(input.rawBody) as unknown
    const envelope = parseChatwootWebhookEnvelope(json)
    if (!envelope) return { ok: false, code: 'VALIDATION', message: 'Invalid webhook payload' }
    parsed = envelope
  } catch {
    return { ok: false, code: 'VALIDATION', message: 'Invalid webhook payload' }
  }

  const auth = verifyChatwootRelaySignature({
    rawBody: input.rawBody,
    signatureHeader: input.signatureHeader,
    timestampHeader: input.timestampHeader,
    relaySecret: input.relaySecret,
    toleranceSeconds: input.toleranceSeconds,
  })
  if (!auth.ok) return auth

  const payloadHash = buildWebhookPayloadFingerprint(input.rawBody)
  const externalAccountId = parsed.account?.id != null ? String(parsed.account.id) : null
  const externalEventRef = scopedExternalEventRef(parsed, payloadHash)
  const eventDedupeKey =
    externalAccountId != null
      ? buildWebhookEventDedupeKey({
          providerInstanceId: input.providerInstanceId,
          externalAccountId,
          eventType: parsed.event,
          externalEventRef,
        })
      : buildWebhookEventDedupeKey({
          providerInstanceId: input.providerInstanceId,
          externalAccountId: 'unknown',
          eventType: parsed.event,
          externalEventRef,
        })

  const idempotencyKey = buildWebhookIdempotencyKey({
    eventDedupeKey,
    clientIdempotencyKey: input.clientIdempotencyKey,
  })

  const existingByDedupe = await prisma.commsWebhookReceipt.findUnique({ where: { eventDedupeKey } })
  if (existingByDedupe) {
    if (existingByDedupe.payloadHash !== payloadHash) {
      return { ok: false, code: 'CONFLICT', message: 'Duplicate event reference with different payload' }
    }
    return {
      ok: true,
      value: { receiptId: existingByDedupe.id, status: 'DUPLICATE', processingStatus: 'PENDING' },
    }
  }

  const existingByIdempotency = await prisma.commsWebhookReceipt.findUnique({ where: { idempotencyKey } })
  if (existingByIdempotency) {
    if (existingByIdempotency.payloadHash !== payloadHash) {
      return { ok: false, code: 'CONFLICT', message: 'Webhook idempotency key reused with different payload' }
    }
    return {
      ok: true,
      value: { receiptId: existingByIdempotency.id, status: 'DUPLICATE', processingStatus: 'PENDING' },
    }
  }

  const inboxId =
    parsed.inbox?.id != null
      ? String(parsed.inbox.id)
      : parsed.conversation?.inbox_id != null
        ? String(parsed.conversation.inbox_id)
        : null

  if (!externalAccountId) {
    const receipt = await prisma.commsWebhookReceipt.create({
      data: {
        providerKey: 'chatwoot',
        providerInstanceId: input.providerInstanceId,
        externalEventId: externalEventRef,
        eventType: parsed.event,
        payloadHash,
        eventDedupeKey,
        idempotencyKey,
        relayTimestampSeconds: auth.value.relayTimestampSeconds,
        receiptStatus: 'QUARANTINED',
        processingStatus: 'FAILED',
        quarantineReason: 'UNKNOWN_TENANT',
        sanitizedDetail: { event: parsed.event, payloadHash },
      },
    })
    return { ok: true, value: { receiptId: receipt.id, status: 'QUARANTINED', processingStatus: 'PENDING' } }
  }

  const tenant = await resolveChatwootTenantByExternalAccount({
    providerInstanceId: input.providerInstanceId,
    externalAccountId,
  })
  if (!tenant.ok) {
    const receipt = await prisma.commsWebhookReceipt.create({
      data: {
        providerKey: 'chatwoot',
        providerInstanceId: input.providerInstanceId,
        externalEventId: externalEventRef,
        eventType: parsed.event,
        payloadHash,
        eventDedupeKey,
        idempotencyKey,
        relayTimestampSeconds: auth.value.relayTimestampSeconds,
        receiptStatus: 'QUARANTINED',
        processingStatus: 'FAILED',
        quarantineReason: 'UNMAPPED_TENANT',
        sanitizedDetail: { event: parsed.event, externalAccountId, payloadHash },
      },
    })
    return { ok: true, value: { receiptId: receipt.id, status: 'QUARANTINED', processingStatus: 'PENDING' } }
  }

  if (inboxId) {
    const inboxOk = await assertInboxAuthorizedForTenant(tenant.value, inboxId)
    if (!inboxOk.ok) {
      const receipt = await prisma.commsWebhookReceipt.create({
        data: {
          providerKey: 'chatwoot',
          providerInstanceId: input.providerInstanceId,
          customerAccountId: tenant.value.customerAccountId,
          tenantMappingId: tenant.value.tenantMappingId,
          externalAccountId,
          externalEventId: externalEventRef,
          eventType: parsed.event,
          payloadHash,
          eventDedupeKey,
          idempotencyKey,
          relayTimestampSeconds: auth.value.relayTimestampSeconds,
          receiptStatus: 'QUARANTINED',
          processingStatus: 'FAILED',
          quarantineReason: 'UNAUTHORIZED_INBOX',
          sanitizedDetail: { event: parsed.event, inboxId, payloadHash },
        },
      })
      return { ok: true, value: { receiptId: receipt.id, status: 'QUARANTINED', processingStatus: 'PENDING' } }
    }
  }

  const receipt = await prisma.commsWebhookReceipt.create({
    data: {
      providerKey: 'chatwoot',
      providerInstanceId: input.providerInstanceId,
      customerAccountId: tenant.value.customerAccountId,
      tenantMappingId: tenant.value.tenantMappingId,
      externalAccountId,
      externalEventId: externalEventRef,
      eventType: parsed.event,
      payloadHash,
      eventDedupeKey,
      idempotencyKey,
      relayTimestampSeconds: auth.value.relayTimestampSeconds,
      receiptStatus: 'RECEIVED',
      processingStatus: 'PENDING',
      sanitizedDetail: JSON.parse(
        JSON.stringify({
          envelope: parsed,
          tenantMappingId: tenant.value.tenantMappingId,
          externalAccountId,
          inboxId,
          payloadHash,
        }),
      ),
    },
  })

  return { ok: true, value: { receiptId: receipt.id, status: 'ACCEPTED', processingStatus: 'PENDING' } }
}

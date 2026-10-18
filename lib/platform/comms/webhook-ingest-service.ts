import { createHash } from 'node:crypto'
import { COMMS_WEBHOOK_MAX_BODY_BYTES, COMMS_WEBHOOK_REPLAY_TOLERANCE_SECONDS } from '@/config/comms-backend'
import { prisma } from '@/lib/db'
import {
  externalEventIdFromEnvelope,
  parseChatwootWebhookEnvelope,
  type ChatwootWebhookEnvelope,
} from '@/lib/platform/comms/webhook-schemas'
import { verifyChatwootRelaySignature, verifyWebhookTimestamp } from '@/lib/platform/comms/webhook-auth'
import { resolveChatwootTenantByExternalAccount, assertInboxAuthorizedForTenant } from '@/lib/platform/comms/tenant-resolve'
import type { CommsResult } from '@/lib/platform/comms/types'

export async function ingestChatwootWebhook(input: {
  providerInstanceId: string
  rawBody: string
  signatureHeader: string | null
  relaySecret: string | null
  idempotencyKey: string
}): Promise<CommsResult<{ receiptId: string; status: 'ACCEPTED' | 'DUPLICATE' | 'QUARANTINED' }>> {
  if (Buffer.byteLength(input.rawBody, 'utf8') > COMMS_WEBHOOK_MAX_BODY_BYTES) {
    return { ok: false, code: 'VALIDATION', message: 'Webhook body too large' }
  }
  const auth = verifyChatwootRelaySignature({
    rawBody: input.rawBody,
    signatureHeader: input.signatureHeader,
    relaySecret: input.relaySecret,
  })
  if (!auth.ok) return auth

  let parsed: ChatwootWebhookEnvelope
  try {
    const json = JSON.parse(input.rawBody) as unknown
    const envelope = parseChatwootWebhookEnvelope(json)
    if (!envelope) return { ok: false, code: 'VALIDATION', message: 'Invalid webhook payload' }
    parsed = envelope
  } catch {
    return { ok: false, code: 'VALIDATION', message: 'Invalid webhook payload' }
  }

  const externalEventId = externalEventIdFromEnvelope(parsed)
  const payloadHash = createHash('sha256').update(input.rawBody).digest('hex')

  const existing = await prisma.commsWebhookReceipt.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  })
  if (existing) {
    if (existing.payloadHash !== payloadHash) {
      return { ok: false, code: 'CONFLICT', message: 'Webhook idempotency key reused with different payload' }
    }
    return { ok: true, value: { receiptId: existing.id, status: 'DUPLICATE' } }
  }

  const externalAccountId = parsed.account?.id != null ? String(parsed.account.id) : null
  if (!externalAccountId) {
    const receipt = await prisma.commsWebhookReceipt.create({
      data: {
        providerKey: 'chatwoot',
        providerInstanceId: input.providerInstanceId,
        externalEventId,
        eventType: parsed.event,
        payloadHash,
        idempotencyKey: input.idempotencyKey,
        receiptStatus: 'QUARANTINED',
        processingStatus: 'FAILED',
        quarantineReason: 'UNKNOWN_TENANT',
        sanitizedDetail: { event: parsed.event },
      },
    })
    return { ok: true, value: { receiptId: receipt.id, status: 'QUARANTINED' } }
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
        externalEventId,
        eventType: parsed.event,
        payloadHash,
        idempotencyKey: input.idempotencyKey,
        receiptStatus: 'QUARANTINED',
        processingStatus: 'FAILED',
        quarantineReason: 'UNMAPPED_TENANT',
        sanitizedDetail: { event: parsed.event, externalAccountId },
      },
    })
    return { ok: true, value: { receiptId: receipt.id, status: 'QUARANTINED' } }
  }

  const inboxId =
    parsed.inbox?.id != null
      ? String(parsed.inbox.id)
      : parsed.conversation?.inbox_id != null
        ? String(parsed.conversation.inbox_id)
        : null
  if (inboxId) {
    const inboxOk = await assertInboxAuthorizedForTenant(tenant.value, inboxId)
    if (!inboxOk.ok) {
      const receipt = await prisma.commsWebhookReceipt.create({
        data: {
          providerKey: 'chatwoot',
          providerInstanceId: input.providerInstanceId,
          customerAccountId: tenant.value.customerAccountId,
          externalEventId,
          eventType: parsed.event,
          payloadHash,
          idempotencyKey: input.idempotencyKey,
          receiptStatus: 'QUARANTINED',
          processingStatus: 'FAILED',
          quarantineReason: 'UNAUTHORIZED_INBOX',
          sanitizedDetail: { event: parsed.event, inboxId },
        },
      })
      return { ok: true, value: { receiptId: receipt.id, status: 'QUARANTINED' } }
    }
  }

  const ts =
    typeof parsed.message?.created_at === 'number'
      ? parsed.message.created_at
      : typeof parsed.message?.created_at === 'string'
        ? Number(parsed.message.created_at)
        : undefined
  const tsOk = verifyWebhookTimestamp({
    eventTimestamp: Number.isFinite(ts) ? ts : undefined,
    toleranceSeconds: COMMS_WEBHOOK_REPLAY_TOLERANCE_SECONDS,
  })
  if (!tsOk.ok) return tsOk

  const receipt = await prisma.commsWebhookReceipt.create({
    data: {
      providerKey: 'chatwoot',
      providerInstanceId: input.providerInstanceId,
      customerAccountId: tenant.value.customerAccountId,
      externalEventId,
      eventType: parsed.event,
      payloadHash,
      idempotencyKey: input.idempotencyKey,
      receiptStatus: 'RECEIVED',
      processingStatus: 'PENDING',
      sanitizedDetail: { event: parsed.event, externalAccountId, inboxId },
    },
  })

  return { ok: true, value: { receiptId: receipt.id, status: 'ACCEPTED' } }
}

import { prisma } from '@/lib/db'
import type { CommsResult } from '@/lib/platform/comms/types'
import { parseChatwootWebhookEnvelope, type ChatwootWebhookEnvelope } from '@/lib/platform/comms/webhook-schemas'
import { resolveChatwootTenantByExternalAccount, assertInboxAuthorizedForTenant } from '@/lib/platform/comms/tenant-resolve'
import { processTrustedChatwootReceiptPayload } from '@/lib/platform/comms/event-processor'

export type StoredReceiptEnvelope = {
  envelope: ChatwootWebhookEnvelope
  tenantMappingId: string
  externalAccountId: string
  inboxId: string | null
  payloadHash: string
}

export function parseStoredReceiptEnvelope(sanitizedDetail: unknown): StoredReceiptEnvelope | null {
  if (!sanitizedDetail || typeof sanitizedDetail !== 'object') return null
  const detail = sanitizedDetail as Record<string, unknown>
  const envelope = detail.envelope
  if (!envelope) return null
  const parsed = parseChatwootWebhookEnvelope(envelope)
  if (!parsed) return null
  const tenantMappingId = detail.tenantMappingId
  const externalAccountId = detail.externalAccountId
  const payloadHash = detail.payloadHash
  if (typeof tenantMappingId !== 'string' || typeof externalAccountId !== 'string' || typeof payloadHash !== 'string') {
    return null
  }
  return {
    envelope: parsed,
    tenantMappingId,
    externalAccountId,
    inboxId: typeof detail.inboxId === 'string' ? detail.inboxId : null,
    payloadHash,
  }
}

/** Atomic claim: only one worker may move PENDING -> PROCESSING. */
export async function claimCommsWebhookReceipt(input: {
  receiptId: string
  workerId: string
}): Promise<CommsResult<{ claimed: boolean }>> {
  const updated = await prisma.commsWebhookReceipt.updateMany({
    where: { id: input.receiptId, processingStatus: 'PENDING', receiptStatus: 'RECEIVED' },
    data: { processingStatus: 'PROCESSING', claimedBy: input.workerId, claimedAt: new Date() },
  })
  if (updated.count === 0) {
    const existing = await prisma.commsWebhookReceipt.findUnique({ where: { id: input.receiptId } })
    if (!existing) return { ok: false, code: 'NOT_FOUND', message: 'Receipt not found' }
    if (existing.processingStatus === 'PROCESSED' || existing.processingStatus === 'DUPLICATE') {
      return { ok: true, value: { claimed: false } }
    }
    return { ok: false, code: 'CONFLICT', message: 'Receipt already claimed or not processable' }
  }
  return { ok: true, value: { claimed: true } }
}

/**
 * Trusted processor entry: only receiptId (+ workerId). No caller-supplied tenant/account.
 * CRM side effects commit here; HTTP ingest only records PENDING receipts.
 */
export async function processCommsWebhookReceiptById(input: {
  receiptId: string
  workerId: string
}): Promise<CommsResult<{ processed: boolean; processingStatus: string }>> {
  const receipt = await prisma.commsWebhookReceipt.findUnique({ where: { id: input.receiptId } })
  if (!receipt) return { ok: false, code: 'NOT_FOUND', message: 'Receipt not found' }

  if (receipt.receiptStatus !== 'RECEIVED') {
    return { ok: false, code: 'FORBIDDEN', message: 'Quarantined or rejected receipt cannot be processed' }
  }
  if (receipt.processingStatus === 'PROCESSED' || receipt.processingStatus === 'DUPLICATE') {
    return { ok: true, value: { processed: false, processingStatus: receipt.processingStatus } }
  }

  const claim = await claimCommsWebhookReceipt({ receiptId: input.receiptId, workerId: input.workerId })
  if (!claim.ok) return claim
  if (!claim.value.claimed) {
    return { ok: true, value: { processed: false, processingStatus: receipt.processingStatus } }
  }

  const stored = parseStoredReceiptEnvelope(receipt.sanitizedDetail)
  if (!stored || stored.payloadHash !== receipt.payloadHash) {
    await prisma.commsWebhookReceipt.update({
      where: { id: receipt.id },
      data: { processingStatus: 'FAILED', quarantineReason: 'TAMPERED_RECEIPT' },
    })
    return { ok: false, code: 'FORBIDDEN', message: 'Receipt payload provenance invalid' }
  }

  if (!receipt.customerAccountId || !receipt.providerInstanceId || !receipt.tenantMappingId) {
    await prisma.commsWebhookReceipt.update({
      where: { id: receipt.id },
      data: { processingStatus: 'FAILED' },
    })
    return { ok: false, code: 'NOT_CONFIGURED', message: 'Receipt missing verified tenant binding' }
  }

  const tenant = await resolveChatwootTenantByExternalAccount({
    providerInstanceId: receipt.providerInstanceId,
    externalAccountId: stored.externalAccountId,
  })
  if (!tenant.ok || tenant.value.customerAccountId !== receipt.customerAccountId) {
    await prisma.commsWebhookReceipt.update({
      where: { id: receipt.id },
      data: { processingStatus: 'FAILED', quarantineReason: 'TENANT_MISMATCH' },
    })
    return { ok: false, code: 'FORBIDDEN', message: 'Receipt tenant revalidation failed' }
  }
  if (tenant.value.tenantMappingId !== receipt.tenantMappingId) {
    await prisma.commsWebhookReceipt.update({
      where: { id: receipt.id },
      data: { processingStatus: 'FAILED', quarantineReason: 'MAPPING_MISMATCH' },
    })
    return { ok: false, code: 'FORBIDDEN', message: 'Tenant mapping mismatch' }
  }

  const inboxId = stored.inboxId
  if (inboxId) {
    const inboxOk = await assertInboxAuthorizedForTenant(tenant.value, inboxId)
    if (!inboxOk.ok) {
      await prisma.commsWebhookReceipt.update({
        where: { id: receipt.id },
        data: { processingStatus: 'FAILED', quarantineReason: 'INBOX_MISMATCH' },
      })
      return { ok: false, code: 'FORBIDDEN', message: 'Inbox authorization failed on process' }
    }
  }

  const envelopeAccountId = stored.envelope.account?.id != null ? String(stored.envelope.account.id) : null
  if (envelopeAccountId && envelopeAccountId !== stored.externalAccountId) {
    await prisma.commsWebhookReceipt.update({
      where: { id: receipt.id },
      data: { processingStatus: 'FAILED', quarantineReason: 'ACCOUNT_MISMATCH' },
    })
    return { ok: false, code: 'FORBIDDEN', message: 'Event account does not match receipt tenant' }
  }

  const processed = await processTrustedChatwootReceiptPayload({
    receiptId: receipt.id,
    customerAccountId: receipt.customerAccountId,
    tenantMappingId: receipt.tenantMappingId,
    envelope: stored.envelope,
    inboxId,
    eventDedupeKey: receipt.eventDedupeKey,
  })

  if (!processed.ok) {
    await prisma.commsWebhookReceipt.update({
      where: { id: receipt.id },
      data: { processingStatus: 'FAILED' },
    })
    return processed
  }

  await prisma.commsWebhookReceipt.update({
    where: { id: receipt.id },
    data: { processingStatus: 'PROCESSED', processedAt: new Date() },
  })

  return { ok: true, value: { processed: true, processingStatus: 'PROCESSED' } }
}

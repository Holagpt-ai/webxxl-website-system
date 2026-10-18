import { createHash } from 'crypto'

/** Billable provider outcomes eligible for wallet settlement (verified ingestion only). */
export const BILLABLE_PROVIDER_NORMALIZED_STATUSES = new Set(['DELIVERED', 'BILLABLE'])

export function isBillableProviderNormalizedStatus(status: string): boolean {
  return BILLABLE_PROVIDER_NORMALIZED_STATUSES.has(status.toUpperCase())
}

export function buildProviderEventFingerprint(input: {
  providerKey: string
  externalEventId: string
  payloadHash: string
  reservationId: string
  settleAmount: number
}): string {
  const payload = [
    input.providerKey,
    input.externalEventId,
    input.payloadHash,
    input.reservationId,
    String(input.settleAmount),
  ].join('|')
  return createHash('sha256').update(payload).digest('hex')
}

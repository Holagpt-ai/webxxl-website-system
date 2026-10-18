import { createHash } from 'crypto'

export type ReservationFingerprintInput = {
  walletId: string
  customerAccountId: string
  managedSiteId?: string | null
  channel?: string | null
  usagePurpose?: string | null
  amount: number
  rateVersion?: string | null
  correlationId: string
}

/** Immutable operation fingerprint for idempotency conflict detection (distinct from idempotencyKey replay). */
export function buildReservationRequestFingerprint(input: ReservationFingerprintInput): string {
  const payload = [
    input.walletId,
    input.customerAccountId,
    input.managedSiteId ?? '',
    input.channel ?? '',
    input.usagePurpose ?? '',
    String(input.amount),
    input.rateVersion ?? '',
    input.correlationId,
  ].join('|')
  return createHash('sha256').update(payload).digest('hex')
}

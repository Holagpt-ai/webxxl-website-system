import { createHash } from 'crypto'

export type ReservationFingerprintInput = {
  billingGroupId: string
  walletId: string
  customerAccountId: string
  managedSiteId?: string | null
  channel?: string | null
  usagePurpose?: string | null
  amount: number
  rateVersion?: string | null
  correlationId: string
  campaignId?: string | null
  expiresAt: Date
}

/** Immutable operation fingerprint for idempotency conflict detection (distinct from idempotencyKey replay). */
export function buildReservationRequestFingerprint(input: ReservationFingerprintInput): string {
  const payload = [
    input.billingGroupId,
    input.walletId,
    input.customerAccountId,
    input.managedSiteId ?? '',
    input.channel ?? '',
    input.usagePurpose ?? '',
    String(input.amount),
    input.rateVersion ?? '',
    input.correlationId,
    input.campaignId ?? '',
    input.expiresAt.toISOString(),
  ].join('|')
  return createHash('sha256').update(payload).digest('hex')
}

export function reservationFingerprintMatches(
  stored: string | null | undefined,
  expected: string,
): boolean {
  return stored === expected
}

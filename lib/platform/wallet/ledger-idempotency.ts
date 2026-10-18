import { createHash } from 'crypto'
import type { DurableRefundCreditsInput, DurableSettleCreditsInput } from '@/lib/platform/wallet/durable-contracts'
import type { WalletLedgerEntryRecord, WalletResult } from '@/lib/platform/wallet/types'

type LedgerRow = {
  id: string
  walletId: string
  customerAccountId: string | null
  type: WalletLedgerEntryRecord['type']
  deltaCredits: number
  reservationId: string | null
  originalLedgerEntryId: string | null
  idempotencyKey: string
}

type ReservationRow = {
  id: string
  walletId: string
  originAccountId: string
}

export function buildSettleRequestFingerprint(input: {
  walletId: string
  reservationId: string
  amount: number
  providerRef?: string | null
  managedSiteId?: string | null
  campaignId?: string | null
}): string {
  const payload = [
    input.walletId,
    input.reservationId,
    String(input.amount),
    input.providerRef ?? '',
    input.managedSiteId ?? '',
    input.campaignId ?? '',
  ].join('|')
  return createHash('sha256').update(payload).digest('hex')
}

export function buildRefundRequestFingerprint(input: {
  walletId: string
  originalLedgerId: string
  amount: number
  priceVersion?: string | null
  refundReason?: string | null
}): string {
  const payload = [
    input.walletId,
    input.originalLedgerId,
    String(input.amount),
    input.priceVersion ?? '',
    input.refundReason ?? '',
  ].join('|')
  return createHash('sha256').update(payload).digest('hex')
}

export function validateSettleLedgerIdempotencyReplay<L extends LedgerRow>(
  existing: L,
  input: DurableSettleCreditsInput,
  reservation: ReservationRow,
  mapLedger: (row: L) => WalletLedgerEntryRecord,
): WalletResult<WalletLedgerEntryRecord> {
  if (existing.type !== 'SETTLE') return { ok: false, error: 'IDEMPOTENCY_CONFLICT' }
  if (existing.walletId !== reservation.walletId) return { ok: false, error: 'IDEMPOTENCY_CONFLICT' }
  if (existing.reservationId !== input.reservationId) return { ok: false, error: 'IDEMPOTENCY_CONFLICT' }
  if (Math.abs(existing.deltaCredits) !== input.amount) return { ok: false, error: 'IDEMPOTENCY_CONFLICT' }
  if (existing.customerAccountId !== reservation.originAccountId) {
    return { ok: false, error: 'IDEMPOTENCY_CONFLICT' }
  }
  return { ok: true, value: mapLedger(existing) }
}

export function validateRefundLedgerIdempotencyReplay<L extends LedgerRow, O extends LedgerRow>(
  existing: L,
  input: DurableRefundCreditsInput,
  original: O,
  mapLedger: (row: L) => WalletLedgerEntryRecord,
): WalletResult<WalletLedgerEntryRecord> {
  if (existing.type !== 'REFUND') return { ok: false, error: 'IDEMPOTENCY_CONFLICT' }
  if (existing.walletId !== input.walletId) return { ok: false, error: 'IDEMPOTENCY_CONFLICT' }
  if (existing.originalLedgerEntryId !== input.originalLedgerId) {
    return { ok: false, error: 'IDEMPOTENCY_CONFLICT' }
  }
  if (existing.deltaCredits !== input.amount) return { ok: false, error: 'IDEMPOTENCY_CONFLICT' }
  if (original.walletId !== input.walletId) return { ok: false, error: 'IDEMPOTENCY_CONFLICT' }
  if (existing.customerAccountId !== original.customerAccountId) {
    return { ok: false, error: 'IDEMPOTENCY_CONFLICT' }
  }
  return { ok: true, value: mapLedger(existing) }
}

export function validateProviderReceiptLedgerScope(input: {
  receiptWalletId: string | null | undefined
  receiptReservationId: string | null | undefined
  reservationId: string
  reservationWalletId: string
  ledger: LedgerRow | null
  settleAmount: number
}): boolean {
  if (input.receiptWalletId && input.receiptWalletId !== input.reservationWalletId) return false
  if (input.receiptReservationId && input.receiptReservationId !== input.reservationId) return false
  if (!input.ledger) return false
  if (input.ledger.walletId !== input.reservationWalletId) return false
  if (input.ledger.reservationId !== input.reservationId) return false
  if (input.ledger.type !== 'SETTLE') return false
  if (Math.abs(input.ledger.deltaCredits) !== input.settleAmount) return false
  return true
}

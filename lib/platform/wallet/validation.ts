export type AmountValidationResult = { ok: true; amount: number } | { ok: false; reason: 'INVALID_AMOUNT' }

/** Credits are positive integers only (no floats, zero, or non-finite values). */
export function validateCreditAmount(value: number): AmountValidationResult {
  if (!Number.isFinite(value)) return { ok: false, reason: 'INVALID_AMOUNT' }
  if (!Number.isInteger(value)) return { ok: false, reason: 'INVALID_AMOUNT' }
  if (value <= 0) return { ok: false, reason: 'INVALID_AMOUNT' }
  return { ok: true, amount: value }
}

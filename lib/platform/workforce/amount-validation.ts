import type { WorkforceResult } from '@/lib/platform/workforce/types'

export function assertPositiveIntegerSubunits(amount: number, field: string): WorkforceResult<true> {
  if (!Number.isFinite(amount)) {
    return { ok: false, code: 'INVALID_AMOUNT', message: `${field} must be a finite number` }
  }
  if (!Number.isInteger(amount)) {
    return { ok: false, code: 'INVALID_AMOUNT', message: `${field} must be an integer subunit amount` }
  }
  if (amount <= 0) {
    return { ok: false, code: 'INVALID_AMOUNT', message: `${field} must be greater than zero` }
  }
  if (!Number.isSafeInteger(amount)) {
    return { ok: false, code: 'INVALID_AMOUNT', message: `${field} exceeds safe integer range` }
  }
  return { ok: true, value: true }
}

export function assertNonNegativeIntegerSubunits(amount: number, field: string): WorkforceResult<true> {
  if (!Number.isFinite(amount)) {
    return { ok: false, code: 'INVALID_AMOUNT', message: `${field} must be a finite number` }
  }
  if (!Number.isInteger(amount)) {
    return { ok: false, code: 'INVALID_AMOUNT', message: `${field} must be an integer subunit amount` }
  }
  if (amount < 0) {
    return { ok: false, code: 'INVALID_AMOUNT', message: `${field} cannot be negative` }
  }
  if (!Number.isSafeInteger(amount)) {
    return { ok: false, code: 'INVALID_AMOUNT', message: `${field} exceeds safe integer range` }
  }
  return { ok: true, value: true }
}

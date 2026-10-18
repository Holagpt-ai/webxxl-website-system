import {
  workforceDefaultBudgetPeriodKey,
  workforceGlobalBudgetSubunitsLimit,
} from '@/config/workforce'
import { assertNonNegativeIntegerSubunits, assertPositiveIntegerSubunits } from '@/lib/platform/workforce/amount-validation'
import { nextWorkforceId, type WorkforceStore } from '@/lib/platform/workforce/in-memory-store'
import type { WorkforceResult } from '@/lib/platform/workforce/types'

/**
 * In-memory budget accounting for AGENT-03 tests and disabled runtime.
 * Durable transactional reservations/settlement will mirror these rules in a future pilot.
 */

function periodUsageSubunits(store: WorkforceStore, agentKey: string, periodKey: string): number {
  let total = 0
  for (const row of store.budgetUsage.values()) {
    if (row.internalAgentKey !== agentKey || row.periodKey !== periodKey) continue
    total += row.settledSubunits + (row.released ? 0 : row.reservedSubunits)
  }
  return total
}

function globalUsageSubunits(store: WorkforceStore, periodKey: string): number {
  let total = 0
  for (const row of store.budgetUsage.values()) {
    if (row.periodKey !== periodKey) continue
    total += row.settledSubunits + (row.released ? 0 : row.reservedSubunits)
  }
  return total
}

function assertValidGlobalLimit(): WorkforceResult<number> {
  const limit = workforceGlobalBudgetSubunitsLimit()
  const valid = assertPositiveIntegerSubunits(limit, 'INTERNAL_WORKFORCE_BUDGET_SUBUNITS')
  if (!valid.ok) return valid
  return { ok: true, value: limit }
}

export function reserveWorkforceBudget(
  store: WorkforceStore,
  input: {
    internalAgentKey: string
    taskId?: string
    idempotencyKey: string
    amountSubunits: number
    agentLimitSubunits: number | null
    periodKey?: string
  },
): WorkforceResult<{ reservationId: string }> {
  const amountCheck = assertPositiveIntegerSubunits(input.amountSubunits, 'amountSubunits')
  if (!amountCheck.ok) return amountCheck
  if (input.agentLimitSubunits != null) {
    const agentLimitCheck = assertPositiveIntegerSubunits(input.agentLimitSubunits, 'agentLimitSubunits')
    if (!agentLimitCheck.ok) return agentLimitCheck
  }
  const globalLimit = assertValidGlobalLimit()
  if (!globalLimit.ok) return globalLimit

  const periodKey = input.periodKey ?? workforceDefaultBudgetPeriodKey()
  const existing = store.budgetUsage.get(input.idempotencyKey)
  if (existing) {
    if (existing.amountSubunits !== input.amountSubunits) {
      return {
        ok: false,
        code: 'IDEMPOTENCY_CONFLICT',
        message: 'Budget idempotency key reused with different amount',
      }
    }
    return { ok: true, value: { reservationId: existing.id } }
  }

  const globalUsed = globalUsageSubunits(store, periodKey)
  if (globalUsed + input.amountSubunits > globalLimit.value) {
    return { ok: false, code: 'BUDGET_EXCEEDED', message: 'Global internal workforce budget exceeded' }
  }
  if (input.agentLimitSubunits != null) {
    const agentUsed = periodUsageSubunits(store, input.internalAgentKey, periodKey)
    if (agentUsed + input.amountSubunits > input.agentLimitSubunits) {
      return { ok: false, code: 'AGENT_BUDGET_EXCEEDED', message: 'Per-agent budget exceeded' }
    }
  }

  const id = nextWorkforceId('wfbudget')
  store.budgetUsage.set(input.idempotencyKey, {
    id,
    taskId: input.taskId,
    internalAgentKey: input.internalAgentKey,
    idempotencyKey: input.idempotencyKey,
    periodKey,
    amountSubunits: input.amountSubunits,
    costSubunits: 0,
    tokenUnits: 0,
    reservedSubunits: input.amountSubunits,
    settledSubunits: 0,
    released: false,
  })
  return { ok: true, value: { reservationId: id } }
}

export function settleWorkforceBudget(
  store: WorkforceStore,
  idempotencyKey: string,
  settledSubunits: number,
): WorkforceResult<{ settled: true }> {
  const amountCheck = assertNonNegativeIntegerSubunits(settledSubunits, 'settledSubunits')
  if (!amountCheck.ok) return amountCheck
  if (settledSubunits === 0) {
    return { ok: false, code: 'INVALID_AMOUNT', message: 'settledSubunits must be greater than zero' }
  }

  const row = store.budgetUsage.get(idempotencyKey)
  if (!row) return { ok: false, code: 'NOT_FOUND', message: 'Budget reservation missing' }
  if (row.settledSubunits > 0) {
    if (row.settledSubunits === settledSubunits) {
      return { ok: true, value: { settled: true } }
    }
    return {
      ok: false,
      code: 'IDEMPOTENCY_CONFLICT',
      message: 'Budget settlement idempotency conflict',
    }
  }
  if (settledSubunits > row.reservedSubunits) {
    return {
      ok: false,
      code: 'OVER_SETTLEMENT',
      message: 'Cannot settle more than reserved budget',
    }
  }
  row.settledSubunits = settledSubunits
  row.reservedSubunits = row.reservedSubunits - settledSubunits
  row.costSubunits += settledSubunits
  return { ok: true, value: { settled: true } }
}

export function releaseWorkforceBudget(store: WorkforceStore, idempotencyKey: string): WorkforceResult<true> {
  const row = store.budgetUsage.get(idempotencyKey)
  if (!row) return { ok: false, code: 'NOT_FOUND', message: 'Budget reservation missing' }
  row.reservedSubunits = 0
  row.released = true
  return { ok: true, value: true }
}

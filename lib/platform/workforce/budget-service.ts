import { workforceDefaultBudgetPeriodKey, workforceGlobalBudgetSubunitsLimit } from '@/config/workforce'
import { nextWorkforceId, type WorkforceStore } from '@/lib/platform/workforce/in-memory-store'
import type { WorkforceResult } from '@/lib/platform/workforce/types'

function periodUsageSubunits(store: WorkforceStore, agentKey: string, periodKey: string): number {
  let total = 0
  for (const row of store.budgetUsage.values()) {
    if (row.internalAgentKey !== agentKey || row.periodKey !== periodKey || row.released) continue
    total += row.reservedSubunits + row.settledSubunits
  }
  return total
}

function globalUsageSubunits(store: WorkforceStore, periodKey: string): number {
  let total = 0
  for (const row of store.budgetUsage.values()) {
    if (row.periodKey !== periodKey || row.released) continue
    total += row.reservedSubunits + row.settledSubunits
  }
  return total
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
  const periodKey = input.periodKey ?? workforceDefaultBudgetPeriodKey()
  const existing = store.budgetUsage.get(input.idempotencyKey)
  if (existing) return { ok: true, value: { reservationId: existing.id } }

  const globalUsed = globalUsageSubunits(store, periodKey)
  if (globalUsed + input.amountSubunits > workforceGlobalBudgetSubunitsLimit()) {
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
  const row = store.budgetUsage.get(idempotencyKey)
  if (!row) return { ok: false, code: 'NOT_FOUND', message: 'Budget reservation missing' }
  if (row.settledSubunits > 0) return { ok: true, value: { settled: true } }
  row.settledSubunits = settledSubunits
  row.reservedSubunits = Math.max(0, row.reservedSubunits - settledSubunits)
  row.costSubunits += settledSubunits
  return { ok: true, value: { settled: true } }
}

export function releaseWorkforceBudget(store: WorkforceStore, idempotencyKey: string): void {
  const row = store.budgetUsage.get(idempotencyKey)
  if (!row) return
  row.released = true
  row.reservedSubunits = 0
}

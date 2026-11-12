import type { AiWorkforcePreparation } from '@/lib/platform/ai-workforce-execution/types'

export type AccountPauseRecord = {
  customerAccountId: string
  active: boolean
  reason?: string
  setByUserId: string
  updatedAt: string
}

export type AccountBudgetReservation = {
  idempotencyKey: string
  customerAccountId: string
  amountSubunits: number
  periodKey: string
}

export type AiWorkforceOrchestrationStore = {
  preparations: Map<string, AiWorkforcePreparation>
  byIdempotency: Map<string, string>
  pauses: Map<string, AccountPauseRecord>
  budget: Map<string, AccountBudgetReservation>
  nextId: () => string
}

export function createAiWorkforceOrchestrationStore(): AiWorkforceOrchestrationStore {
  let sequence = 0
  return {
    preparations: new Map(),
    byIdempotency: new Map(),
    pauses: new Map(),
    budget: new Map(),
    nextId: () => {
      sequence += 1
      return `aiw_${sequence}`
    },
  }
}

let singleton: AiWorkforceOrchestrationStore | null = null

export function getAiWorkforceOrchestrationStore(): AiWorkforceOrchestrationStore {
  if (!singleton) singleton = createAiWorkforceOrchestrationStore()
  return singleton
}

export function resetAiWorkforceOrchestrationStoreForTests(): void {
  singleton = createAiWorkforceOrchestrationStore()
}

export function idempotencyScope(customerAccountId: string, idempotencyKey: string): string {
  return `${customerAccountId}:${idempotencyKey}`
}

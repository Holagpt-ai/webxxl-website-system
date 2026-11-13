import { isCustomerAiWorkforceEnabled } from '@/config/customer-ai-workforce'

function envFlag(name: string, defaultValue = false): boolean {
  const raw = process.env[name]
  if (raw === undefined) return defaultValue
  return raw === '1' || raw.toLowerCase() === 'true'
}

/** Explicit owner gate for Batch 6 HTTP mutations (preparation, approval, pause). Default off. */
export function isAiWorkforceExecutionHttpEnabled(): boolean {
  return envFlag('AI_WORKFORCE_EXECUTION_HTTP_ENABLED', false)
}

/**
 * Future gate when Batch 6 orchestration is wired to approved persistent storage (not pilot tables).
 * Default off; enabling the env flag alone does not connect storage in this batch.
 */
export function isAiWorkforceExecutionDurablePersistenceEnabled(): boolean {
  return envFlag('AI_WORKFORCE_EXECUTION_DURABLE_ENABLED', false)
}

/**
 * Batch 6 orchestration uses process-local Maps. Production HTTP mutations stay off until
 * durable Batch 6 persistence is implemented and connected — independent of CUSTOMER_AI_PILOT_DURABLE_ENABLED.
 */
export function isAiWorkforceExecutionHttpMutationEnabled(): boolean {
  if (process.env.NODE_ENV === 'test') return true
  if (process.env.NODE_ENV === 'production') {
    if (!isAiWorkforceExecutionDurablePersistenceConnected()) return false
    return isCustomerAiWorkforceEnabled() && isAiWorkforceExecutionHttpEnabled()
  }
  if (!isCustomerAiWorkforceEnabled()) return false
  if (!isAiWorkforceExecutionHttpEnabled()) return false
  return true
}

export function isAiWorkforceExecutionDurablePersistenceConnected(): boolean {
  return false
}

export function describeAiWorkforceOrchestrationPersistence(): {
  persistence: 'IN_MEMORY_PROCESS_LOCAL'
  productionSafe: false
  durablePersistenceConnected: boolean
  httpMutationsEnabled: boolean
  pilotDurableDoesNotSatisfyBatch6: true
  message: string
} {
  const httpMutationsEnabled = isAiWorkforceExecutionHttpMutationEnabled()
  const durablePersistenceConnected = isAiWorkforceExecutionDurablePersistenceConnected()
  return {
    persistence: 'IN_MEMORY_PROCESS_LOCAL',
    productionSafe: false,
    durablePersistenceConnected,
    httpMutationsEnabled,
    pilotDurableDoesNotSatisfyBatch6: true,
    message: httpMutationsEnabled
      ? 'HTTP mutations enabled for this non-production runtime only. External effects remain blocked.'
      : process.env.NODE_ENV === 'production'
        ? 'Batch 6 orchestration is in-memory per process. Production HTTP mutations stay disabled until Batch 6 durable persistence is connected. CUSTOMER_AI_PILOT_DURABLE_ENABLED does not satisfy this gate.'
        : 'Batch 6 orchestration is in-memory per process. Enable CUSTOMER_AI_WORKFORCE_ENABLED and AI_WORKFORCE_EXECUTION_HTTP_ENABLED for gated development preparation.',
  }
}

import {
  isCustomerAiPilotDurableEnabled,
  isCustomerAiWorkforceEnabled,
} from '@/config/customer-ai-workforce'

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
 * Process-local orchestration is not durable or globally enforced on Vercel.
 * Mutations stay disabled in production unless durable pilot persistence is enabled.
 */
export function isAiWorkforceExecutionHttpMutationEnabled(): boolean {
  if (process.env.NODE_ENV === 'test') return true
  if (!isCustomerAiWorkforceEnabled()) return false
  if (!isAiWorkforceExecutionHttpEnabled()) return false
  if (process.env.NODE_ENV === 'production' && !isCustomerAiPilotDurableEnabled()) return false
  return true
}

export function describeAiWorkforceOrchestrationPersistence(): {
  persistence: 'IN_MEMORY_PROCESS_LOCAL'
  productionSafe: boolean
  httpMutationsEnabled: boolean
  message: string
} {
  const httpMutationsEnabled = isAiWorkforceExecutionHttpMutationEnabled()
  const productionSafe =
    process.env.NODE_ENV !== 'production' ||
    (isCustomerAiPilotDurableEnabled() && isAiWorkforceExecutionHttpEnabled())
  return {
    persistence: 'IN_MEMORY_PROCESS_LOCAL',
    productionSafe,
    httpMutationsEnabled,
    message: httpMutationsEnabled
      ? 'HTTP mutations enabled for this runtime only. External effects remain blocked.'
      : 'Batch 6 orchestration is in-memory per process. HTTP mutations are disabled until owner gates and durable persistence are satisfied.',
  }
}

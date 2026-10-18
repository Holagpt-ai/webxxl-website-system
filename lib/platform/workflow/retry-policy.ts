import type { WorkflowErrorClass } from '@prisma/client'

const NON_RETRYABLE: WorkflowErrorClass[] = [
  'PERMANENT',
  'AUTHORIZATION_FAILED',
  'POLICY_DENIED',
  'CONFIGURATION_MISSING',
]

export function isRetryableWorkflowError(errorClass: WorkflowErrorClass): boolean {
  return !NON_RETRYABLE.includes(errorClass)
}

export function computeWorkflowBackoffMs(attemptCount: number, retryAfterMs?: number): number {
  if (retryAfterMs != null && retryAfterMs > 0) {
    return Math.min(retryAfterMs, 86_400_000)
  }
  const base = 2_000
  const cap = 3_600_000
  const exp = Math.min(attemptCount, 10)
  const jitter = Math.floor(Math.random() * 500)
  return Math.min(cap, base * 2 ** exp + jitter)
}

export function classifyWorkflowErrorCode(code: string): WorkflowErrorClass {
  const normalized = code.toUpperCase()
  if (normalized.includes('RATE')) return 'RATE_LIMITED'
  if (normalized.includes('TIMEOUT')) return 'TIMEOUT'
  if (normalized.includes('UNAVAILABLE')) return 'PROVIDER_UNAVAILABLE'
  if (normalized.includes('FORBIDDEN') || normalized.includes('UNAUTHORIZED')) return 'AUTHORIZATION_FAILED'
  if (normalized.includes('POLICY') || normalized.includes('DENIED')) return 'POLICY_DENIED'
  if (normalized.includes('NOT_CONFIGURED') || normalized.includes('MISSING')) return 'CONFIGURATION_MISSING'
  if (normalized.includes('UNKNOWN') || normalized.includes('RECONCIL')) return 'UNKNOWN_EXTERNAL_OUTCOME'
  if (normalized.includes('PERMANENT')) return 'PERMANENT'
  return 'TRANSIENT'
}

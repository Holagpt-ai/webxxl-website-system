function envFlag(name: string, defaultValue = false): boolean {
  const raw = process.env[name]
  if (raw === undefined) return defaultValue
  return raw === '1' || raw.toLowerCase() === 'true'
}

export function isWorkflowBackendEnabled(): boolean {
  return envFlag('WORKFLOW_BACKEND_ENABLED', false)
}

export function isWorkflowEnqueueEnabled(): boolean {
  return envFlag('WORKFLOW_ENQUEUE_ENABLED', false)
}

export function isWorkflowWorkerEnabled(): boolean {
  return envFlag('WORKFLOW_WORKER_ENABLED', false)
}

export function isWorkflowRepairEnabled(): boolean {
  return envFlag('WORKFLOW_REPAIR_ENABLED', false)
}

export function isWorkflowReadEnabled(): boolean {
  return envFlag('WORKFLOW_READ_ENABLED', false)
}

export function isWorkflowExternalEffectsEnabled(): boolean {
  return envFlag('WORKFLOW_EXTERNAL_EFFECTS_ENABLED', false)
}

/** Vitest-only isolated execution; impossible when NODE_ENV=production. */
export function isWorkflowTestExecutionBypassEnabled(): boolean {
  return process.env.NODE_ENV === 'test' && process.env.WORKFLOW_TEST_EXECUTION_BYPASS === 'true'
}

export function isWorkflowDurableExecutionAllowed(): boolean {
  return isWorkflowBackendEnabled() || isWorkflowTestExecutionBypassEnabled()
}

function envPositiveInt(name: string, defaultValue: number, max = 500): number {
  const raw = process.env[name]
  if (raw === undefined || raw === '') return defaultValue
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 1) return defaultValue
  return Math.min(Math.floor(n), max)
}

export const WORKFLOW_CLAIM_BATCH_DEFAULT = envPositiveInt('WORKFLOW_CLAIM_BATCH_DEFAULT', 10, 100)
export const WORKFLOW_GLOBAL_CONCURRENCY = envPositiveInt('WORKFLOW_GLOBAL_CONCURRENCY', 25, 500)
export const WORKFLOW_PER_ACCOUNT_ACTIVE_CAP = envPositiveInt('WORKFLOW_PER_ACCOUNT_ACTIVE_CAP', 5, 100)
export const WORKFLOW_PER_KIND_ACTIVE_CAP = envPositiveInt('WORKFLOW_PER_KIND_ACTIVE_CAP', 10, 100)
export const WORKFLOW_LEASE_TTL_MS = envPositiveInt('WORKFLOW_LEASE_TTL_MS', 120_000, 3_600_000)
export const WORKFLOW_OUTBOX_DISPATCH_LEASE_MS = envPositiveInt('WORKFLOW_OUTBOX_DISPATCH_LEASE_MS', 120_000, 3_600_000)

export function validatedWorkflowClaimBatchLimit(requested?: number): number {
  const n = requested ?? WORKFLOW_CLAIM_BATCH_DEFAULT
  if (!Number.isFinite(n) || n < 1) return WORKFLOW_CLAIM_BATCH_DEFAULT
  return Math.min(Math.floor(n), WORKFLOW_CLAIM_BATCH_DEFAULT, WORKFLOW_GLOBAL_CONCURRENCY)
}

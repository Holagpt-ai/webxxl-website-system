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

export const WORKFLOW_CLAIM_BATCH_DEFAULT = Number(process.env.WORKFLOW_CLAIM_BATCH_DEFAULT ?? '10')
export const WORKFLOW_GLOBAL_CONCURRENCY = Number(process.env.WORKFLOW_GLOBAL_CONCURRENCY ?? '25')
export const WORKFLOW_PER_ACCOUNT_ACTIVE_CAP = Number(process.env.WORKFLOW_PER_ACCOUNT_ACTIVE_CAP ?? '5')
export const WORKFLOW_LEASE_TTL_MS = Number(process.env.WORKFLOW_LEASE_TTL_MS ?? '120000')

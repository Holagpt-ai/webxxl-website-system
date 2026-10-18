/**
 * Backend-owned internal workforce activation gates (not customer UI flags).
 */

function envFlag(name: string, defaultValue = false): boolean {
  const raw = process.env[name]
  if (raw === undefined) return defaultValue
  return raw === '1' || raw.toLowerCase() === 'true'
}

export function isInternalWorkforceEnabled(): boolean {
  return envFlag('INTERNAL_WORKFORCE_ENABLED', false)
}

export function isPaperclipExecutionEnabled(): boolean {
  return envFlag('PAPERCLIP_EXECUTION_ENABLED', false)
}

export function isAutonomousCodeWritesEnabled(): boolean {
  return envFlag('AUTONOMOUS_CODE_WRITES_ENABLED', false)
}

export function isAutonomousProductionActionsEnabled(): boolean {
  return envFlag('AUTONOMOUS_PRODUCTION_ACTIONS', false)
}

export function workforceGlobalBudgetSubunitsLimit(): number {
  return Number(process.env.INTERNAL_WORKFORCE_BUDGET_SUBUNITS ?? '100000')
}

export function workforceDefaultBudgetPeriodKey(): string {
  return process.env.INTERNAL_WORKFORCE_BUDGET_PERIOD ?? '2026-10'
}

export function paperclipBaseUrl(): string {
  return process.env.WORKFORCE_BASE_URL ?? process.env.PAPERCLIP_BASE_URL ?? ''
}

/** @deprecated prefer functions above — kept for static analysis callers */
export const workforceRuntime = {
  get internalWorkforceEnabled() {
    return isInternalWorkforceEnabled()
  },
  get paperclipExecutionEnabled() {
    return isPaperclipExecutionEnabled()
  },
  get globalBudgetSubunitsLimit() {
    return workforceGlobalBudgetSubunitsLimit()
  },
  get defaultPeriodKey() {
    return workforceDefaultBudgetPeriodKey()
  },
  get paperclipBaseUrl() {
    return paperclipBaseUrl()
  },
} as const

export function workforceDisabledReason(): string {
  if (!isInternalWorkforceEnabled()) {
    return 'INTERNAL_WORKFORCE_ENABLED is false; internal agents remain disabled.'
  }
  return 'Internal workforce runtime is disabled by policy.'
}

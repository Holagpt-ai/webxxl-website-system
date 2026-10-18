function envFlag(name: string, defaultValue = false): boolean {
  const raw = process.env[name]
  if (raw === undefined) return defaultValue
  return raw === '1' || raw.toLowerCase() === 'true'
}

export function isMktBackendEnabled(): boolean {
  return envFlag('MKT_BACKEND_ENABLED', false)
}

export function isMktDraftPreparationEnabled(): boolean {
  return envFlag('MKT_DRAFT_PREPARATION_ENABLED', false)
}

export function isMktApprovalWorkflowEnabled(): boolean {
  return envFlag('MKT_APPROVAL_WORKFLOW_ENABLED', false)
}

export function isMktLeadMonitorEnabled(): boolean {
  return envFlag('MKT_LEAD_MONITOR_ENABLED', false)
}

export function isMktAiGenerationEnabled(): boolean {
  return envFlag('MKT_AI_GENERATION_ENABLED', false)
}

export function isMktExternalHandoffEnabled(): boolean {
  return envFlag('MKT_EXTERNAL_HANDOFF_ENABLED', false)
}

export function isMktAutomatedExecutionEnabled(): boolean {
  return envFlag('MKT_AUTOMATED_EXECUTION_ENABLED', false)
}

export const MKT_LIST_DEFAULT_TAKE = Number(process.env.MKT_LIST_DEFAULT_TAKE ?? '50')
export const MKT_LIST_MAX_TAKE = Number(process.env.MKT_LIST_MAX_TAKE ?? '100')
export const MKT_MAX_REVISIONS_PER_ARTIFACT = Number(process.env.MKT_MAX_REVISIONS_PER_ARTIFACT ?? '25')

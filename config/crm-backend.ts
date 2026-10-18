/**
 * Backend-owned CRM gates (not customer UI flags).
 */

function envFlag(name: string, defaultValue = false): boolean {
  const raw = process.env[name]
  if (raw === undefined) return defaultValue
  return raw === '1' || raw.toLowerCase() === 'true'
}

export function isCrmBackendEnabled(): boolean {
  return envFlag('CRM_BACKEND_ENABLED', false)
}

export function isCrmExternalSyncEnabled(): boolean {
  return envFlag('CRM_EXTERNAL_SYNC_ENABLED', false)
}

export function isCrmImportEnabled(): boolean {
  return envFlag('CRM_IMPORT_ENABLED', false)
}

export function isCrmExportEnabled(): boolean {
  return envFlag('CRM_EXPORT_ENABLED', false)
}

export function isCrmAiActionsEnabled(): boolean {
  return envFlag('CRM_AI_ACTIONS_ENABLED', false)
}

export const CRM_IMPORT_MAX_ROWS = Number(process.env.CRM_IMPORT_MAX_ROWS ?? '5000')
export const CRM_IMPORT_MAX_FIELDS = Number(process.env.CRM_IMPORT_MAX_FIELDS ?? '40')
export const CRM_EXPORT_PAGE_SIZE = Number(process.env.CRM_EXPORT_PAGE_SIZE ?? '500')

export const CRM_DEFAULT_FOLLOW_UP_DAYS = Number(process.env.CRM_DEFAULT_FOLLOW_UP_DAYS ?? '4')

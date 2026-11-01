/**
 * Backend-owned Marketing Studio / social publishing gates (not customer UI flags).
 */

function envFlag(name: string, defaultValue = false): boolean {
  const raw = process.env[name]
  if (raw === undefined) return defaultValue
  return raw === '1' || raw.toLowerCase() === 'true'
}

export function isSocialMarketingEnabled(): boolean {
  return envFlag('SOCIAL_MARKETING_ENABLED', false)
}

export function isPostizApiEnabled(): boolean {
  return envFlag('POSTIZ_API_ENABLED', false)
}

export function isPostizLivePublishingEnabled(): boolean {
  return envFlag('POSTIZ_LIVE_PUBLISHING_ENABLED', false)
}

/** Guarded scheduling intent prep, provider readiness HTTP, reconcile boundaries (Batch 34). Live dispatch stays gated separately. */
export function isSocialExecutionGatesEnabled(): boolean {
  return envFlag('SOCIAL_EXECUTION_GATES_ENABLED', false)
}

export function isSocialAutomatedApprovalEnabled(): boolean {
  return envFlag('SOCIAL_AUTOMATED_APPROVAL_ENABLED', false)
}

export function postizApiBaseUrl(): string {
  const explicit = process.env.POSTIZ_API_BASE_URL?.trim()
  if (explicit) return explicit.replace(/\/$/, '')
  const scheduler = process.env.NEXT_PUBLIC_SCHEDULER_URL?.trim() || 'https://app.webbxxl.com'
  return `${scheduler.replace(/\/$/, '')}/public/v1`
}

export function postizApiSecretRef(): string | null {
  return process.env.POSTIZ_API_SECRET_REF?.trim() || (process.env.POSTIZ_API_TOKEN ? 'env:POSTIZ_API_TOKEN' : null)
}

export function marketingStudioDefaultPeriodKey(at: Date = new Date()): string {
  const override = process.env.MARKETING_STUDIO_USAGE_PERIOD
  if (override) return override
  const year = at.getUTCFullYear()
  const month = String(at.getUTCMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

export type MarketingStudioQuotaPolicy = {
  draftsPerAccountMonth: number
  schedulingRequestsPerAccountMonth: number
  maxConnectedChannels: number
  contentPlansPerAccountMonth: number
  providerApiCallsPerAccountMonth: number
}

export function marketingStudioQuotaPolicy(): MarketingStudioQuotaPolicy {
  return {
    draftsPerAccountMonth: Number(process.env.MARKETING_STUDIO_DRAFTS_PER_MONTH ?? '50'),
    schedulingRequestsPerAccountMonth: Number(process.env.MARKETING_STUDIO_SCHEDULES_PER_MONTH ?? '30'),
    maxConnectedChannels: Number(process.env.MARKETING_STUDIO_MAX_CHANNELS ?? '10'),
    contentPlansPerAccountMonth: Number(process.env.MARKETING_STUDIO_PLANS_PER_MONTH ?? '5'),
    providerApiCallsPerAccountMonth: Number(process.env.MARKETING_STUDIO_POSTIZ_CALLS_PER_MONTH ?? '100'),
  }
}

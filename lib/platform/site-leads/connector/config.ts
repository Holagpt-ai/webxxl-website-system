import type { SiteLeadConnectorConfig } from '@/lib/platform/site-leads/connector/types'

const DEFAULT_TIMEOUT_MS = 15_000
const DEFAULT_MAX_RETRIES = 2

export function normalizeSiteLeadConnectorConfig(input: SiteLeadConnectorConfig): SiteLeadConnectorConfig {
  const intakeBaseUrl = input.intakeBaseUrl.replace(/\/+$/, '')
  const publicKeyId = input.publicKeyId.trim()
  const signingSecret = input.signingSecret
  if (!intakeBaseUrl) throw new Error('intakeBaseUrl is required')
  if (!publicKeyId) throw new Error('publicKeyId is required')
  if (!signingSecret) throw new Error('signingSecret is required')
  return {
    intakeBaseUrl,
    publicKeyId,
    signingSecret,
    timeoutMs: input.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    maxRetries: input.maxRetries ?? DEFAULT_MAX_RETRIES,
  }
}

/**
 * Server-side env resolution for one managed site.
 * Secret env: `SITE_LEAD_INTAKE_SECRET_{publicKeyId}` or custom `secretEnvVar`.
 * Never log or return the secret from this helper.
 */
export function resolveSiteLeadConnectorConfigFromEnv(input?: {
  intakeBaseUrlEnv?: string
  publicKeyIdEnv?: string
  secretEnvVar?: string
}): SiteLeadConnectorConfig {
  const opts = input ?? {}
  const intakeBaseUrl = process.env[opts.intakeBaseUrlEnv ?? 'WEBXXL_SITE_LEAD_INTAKE_BASE_URL']?.trim()
  const publicKeyId = process.env[opts.publicKeyIdEnv ?? 'WEBXXL_SITE_LEAD_INTAKE_PUBLIC_KEY_ID']?.trim()
  if (!intakeBaseUrl || !publicKeyId) {
    throw new Error('Managed-site lead intake connector is not configured')
  }
  const secretKey = opts.secretEnvVar ?? `SITE_LEAD_INTAKE_SECRET_${publicKeyId}`
  const signingSecret = process.env[secretKey]?.trim()
  if (!signingSecret) {
    throw new Error('Managed-site lead intake signing secret is not configured')
  }
  return normalizeSiteLeadConnectorConfig({ intakeBaseUrl, publicKeyId, signingSecret })
}

/** Safe snapshot for logs — never includes signing material. */
export function redactSiteLeadConnectorConfig(config: SiteLeadConnectorConfig): {
  intakeBaseUrl: string
  publicKeyId: string
  timeoutMs: number
  maxRetries: number
} {
  return {
    intakeBaseUrl: config.intakeBaseUrl,
    publicKeyId: config.publicKeyId,
    timeoutMs: config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    maxRetries: config.maxRetries ?? DEFAULT_MAX_RETRIES,
  }
}

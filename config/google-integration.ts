function envFlag(name: string, defaultValue = false): boolean {
  const raw = process.env[name]
  if (raw === undefined) return defaultValue
  return raw === '1' || raw.toLowerCase() === 'true'
}

/** Batch 33 — stored connection readiness (no live Google OAuth or fetch). */
export function isGoogleProviderReadinessEnabled(): boolean {
  return envFlag('GOOGLE_PROVIDER_READINESS_ENABLED', false)
}

/** Max providers assessed per bounded readiness operation. */
export const GOOGLE_READINESS_MAX_PROVIDERS_PER_OPERATION = 3

/** Max managed sites returned on account-wide readiness GET (no siteId filter). */
export const GOOGLE_READINESS_MAX_SITES_PER_ACCOUNT = 25

export const GOOGLE_READINESS_REQUEST_KEY_MIN_LENGTH = 8
export const GOOGLE_READINESS_REQUEST_KEY_MAX_LENGTH = 128

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

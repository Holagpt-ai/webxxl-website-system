function envFlag(name: string, defaultValue = false): boolean {
  const raw = process.env[name]
  if (raw === undefined) return defaultValue
  return raw === '1' || raw.toLowerCase() === 'true'
}

/** Server-side gate for signed managed-site lead intake (not live form activation). */
export function isSiteLeadIntakeEnabled(): boolean {
  return envFlag('SITE_LEAD_INTAKE_ENABLED', false)
}

export const SITE_LEAD_INTAKE_MAX_BODY_BYTES = Number(process.env.SITE_LEAD_INTAKE_MAX_BODY_BYTES ?? '16384')
export const SITE_LEAD_INTAKE_RATE_LIMIT_PER_MINUTE = Number(process.env.SITE_LEAD_INTAKE_RATE_LIMIT_PER_MINUTE ?? '60')
export const SITE_LEAD_INTAKE_SIGNATURE_TOLERANCE_SECONDS = Number(
  process.env.SITE_LEAD_INTAKE_SIGNATURE_TOLERANCE_SECONDS ?? '300',
)
export const SITE_LEAD_INTAKE_DUPLICATE_WINDOW_MS = Number(process.env.SITE_LEAD_INTAKE_DUPLICATE_WINDOW_MS ?? `${15 * 60 * 1000}`)
export const SITE_LEAD_LIST_DEFAULT_TAKE = Number(process.env.SITE_LEAD_LIST_DEFAULT_TAKE ?? '50')
export const SITE_LEAD_LIST_MAX_TAKE = Number(process.env.SITE_LEAD_LIST_MAX_TAKE ?? '100')
export const SITE_LEAD_INBOX_SAMPLE_LIMIT = Number(process.env.SITE_LEAD_INBOX_SAMPLE_LIMIT ?? '50')
